from django.shortcuts import render, get_object_or_404
from rest_framework import status, generics, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny

from base.custom_permissions import IsTutor, IsStudent
from base.custom_pagination_class import CustomMessagePagination
from .models import Community, Message, Notification, JoinRequest
from .tasks import (
    send_join_request_notification,
    send_join_request_response,
    send_removed_notification,
)
from .serializer import (
    CommunitySerializer,
    MessageSerializer,
    CreateCommunitySerializer,
    JoinCommunitySerializer,
    NotificationSerializer
)
from .serializer import LiveClassSerializer, JoinRequestSerializer
from .models import LiveClass
from .serializer import LiveClassSerializer
from rest_framework import permissions


# Create your views here.

class CommunityCreateAPIView(generics.CreateAPIView):
    """
    API view to create a new community. Only tutors are allowed to create communities.
    """
    queryset = Community.objects.all()
    serializer_class = CreateCommunitySerializer
    permission_classes = [IsTutor]

    def perform_create(self, serializer):
        """
        Save the community instance with the associated tutor profile.
        """
        serializer.save(tutor=self.request.user.tutor_profile)


class ListCommunity(viewsets.ReadOnlyModelViewSet):
    """
    API view to list communities. Accessible to everyone.
    """
    queryset = Community.objects.all()
    serializer_class = CommunitySerializer
    lookup_field = 'slug'
    permission_classes = [AllowAny]

    def get_queryset(self):
        """
        Override to filter communities based on user role (tutor or student).
        """
        user = self.request.user
        queryset = Community.objects.all().order_by('-id')

        if user.is_anonymous or not user.is_authenticated:
            return queryset.all()
        elif hasattr(user, 'role'):
            if user.role == 'tutor':
                return queryset.filter(tutor__user=user)
            elif user.role == 'student':
                return queryset.all()

        return queryset


class JoinCommunityAPIView(APIView):
    """
    API view for users to join a community.
    """

    def post(self, request, slug):
        """
        Handle the POST request to join a community.
        """
        try:
            community = Community.objects.get(slug=slug)
        except Community.DoesNotExist:
            return Response({'error': 'Community not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user in community.participants.all():
            return Response({'error': 'Already a member; you can view the community.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # If the requester is a student, create a JoinRequest (pending) instead of joining directly
        if hasattr(request.user, 'role') and request.user.role == 'student':
            # Create a join request if one doesn't already exist
            jr, created = JoinRequest.objects.get_or_create(community=community, user=request.user)
            if not created:
                if jr.status == JoinRequest.STATUS_PENDING:
                    return Response({'message': 'Join request already pending.'}, status=status.HTTP_200_OK)
                elif jr.status == JoinRequest.STATUS_APPROVED:
                    return Response({'message': 'You are already approved for this community.'}, status=status.HTTP_200_OK)
                else:
                    # previously rejected, allow resubmission by resetting to pending
                    jr.status = JoinRequest.STATUS_PENDING
                    jr.save()
                    return Response({'message': 'Join request re-submitted.'}, status=status.HTTP_200_OK)

            # notify tutor asynchronously
            try:
                tutor_email = community.tutor.user.email
                send_join_request_notification.delay(tutor_email, request.user.username, community.name)
            except Exception:
                pass

            return Response({'message': 'Join request submitted. Please wait for tutor approval.'}, status=status.HTTP_200_OK)

        # If user is a tutor or other roles, allow direct join (maintain legacy behavior)
        serializer = JoinCommunitySerializer(community, data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                serializer.save()
                return Response({'message': 'Successfully joined the community'}, status=status.HTTP_200_OK)
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class JoinRequestListAPIView(generics.ListAPIView):
    """Tutor-only view to list join requests for a community."""
    serializer_class = JoinRequestSerializer

    def get_queryset(self):
        slug = self.kwargs.get('slug')
        community = get_object_or_404(Community, slug=slug)
        # Only the tutor owning the community can view requests
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'tutor' or community.tutor.user != self.request.user:
            return JoinRequest.objects.none()
        return JoinRequest.objects.filter(community=community).order_by('-created_at')


class JoinRequestApproveAPIView(APIView):
    """Tutor-only endpoint to approve or reject join requests."""

    def post(self, request, slug, pk):
        community = get_object_or_404(Community, slug=slug)
        # only community tutor can approve
        if not hasattr(request.user, 'role') or request.user.role != 'tutor' or community.tutor.user != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        jr = get_object_or_404(JoinRequest, pk=pk, community=community)
        action = request.data.get('action')  # 'approve' or 'reject'
        if action == 'approve':
            jr.status = JoinRequest.STATUS_APPROVED
            jr.save()
            # add participant
            community.participants.add(jr.user)
            # notify user
            Notification.objects.create(recipient=jr.user, community=community, message=f'Your request to join {community.name} was approved.', notification_type='message', link=f'/community/{community.slug}')
            try:
                send_join_request_response.delay(jr.user.email, community.name, True)
            except Exception:
                pass
            return Response({'message': 'User approved and added to community.'}, status=status.HTTP_200_OK)
        elif action == 'reject':
            jr.status = JoinRequest.STATUS_REJECTED
            jr.save()
            Notification.objects.create(recipient=jr.user, community=community, message=f'Your request to join {community.name} was rejected.', notification_type='message', link=f'/community/{community.slug}')
            try:
                send_join_request_response.delay(jr.user.email, community.name, False)
            except Exception:
                pass
            return Response({'message': 'Join request rejected.'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class RemoveParticipantAPIView(APIView):
    """Tutor-only endpoint to remove a participant from a community."""

    def post(self, request, slug):
        community = get_object_or_404(Community, slug=slug)
        if not hasattr(request.user, 'role') or request.user.role != 'tutor' or community.tutor.user != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = community.participants.get(id=user_id)
        except Exception:
            return Response({'error': 'User not in community'}, status=status.HTTP_400_BAD_REQUEST)

        community.participants.remove(user)
        Notification.objects.create(recipient=user, community=community, message=f'You have been removed from {community.name}.', notification_type='message', link=f'/community/{community.slug}')
        try:
            send_removed_notification.delay(user.email, community.name)
        except Exception:
            pass
        return Response({'message': 'User removed from community.'}, status=status.HTTP_200_OK)


class ChatHistoryAPIView(generics.ListAPIView):
    """
    API view to retrieve the chat history of a community.
    """
    serializer_class = MessageSerializer
    pagination_class = CustomMessagePagination

    def get_queryset(self):
        """
        Return the messages for the specified community.
        """
        slug = self.kwargs['slug']
        community = get_object_or_404(Community, slug=slug)
        return Message.objects.filter(community=community).order_by('created_at')


@api_view(['POST'])
def exit_community(request, slug):
    """
    API view to allow a user to exit a community.
    """
    community = get_object_or_404(Community, slug=slug)

    if request.user not in community.participants.all():
        return Response({'error': 'You are not a member of this community'},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        community.exit_participant(request.user)
        return Response({'message': 'Successfully exited from community'}, status=status.HTTP_200_OK)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NotificationViewSet(viewsets.ModelViewSet):
    """
    API viewset for managing notifications for the authenticated user.
    """
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        """
        Filter notifications to only those for the authenticated user.
        """
        return self.queryset.filter(recipient=self.request.user)


class LiveClassViewSet(viewsets.ModelViewSet):
    """API endpoints for LiveClass model.

    - list: GET /live-classes/ (only active classes)
    - create: POST /live-classes/ (tutors only)
    - retrieve: GET /live-classes/<id>/
    - destroy: DELETE /live-classes/<id>/ (only tutor who created it)
    """
    queryset = LiveClass.objects.all().order_by('-id')
    serializer_class = LiveClassSerializer

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'update', 'partial_update']:
            return [IsTutor()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        # Only return active classes by default
        qs = LiveClass.objects.filter(is_active=True).order_by('-created_at')
        return qs

    def perform_create(self, serializer):
        # tutor should be provided from request user
        user = self.request.user
        serializer.save(tutor=user)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        # Only tutor who created the live class can delete
        if obj.tutor != request.user:
            return Response({'error': 'Only the tutor who created this class can delete it.'}, status=status.HTTP_403_FORBIDDEN)
        obj.is_active = False
        obj.save()
        return Response({'status': 'live class closed'}, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        """
        Mark a notification as read.
        """
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'}, status=status.HTTP_200_OK)
