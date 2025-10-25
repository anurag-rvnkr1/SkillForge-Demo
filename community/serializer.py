from .models import Community, Message, Thread, Notification, LiveClass
from rest_framework import serializers
from users.api.user_serializers import UserSerializers


class ThreadSerializer(serializers.ModelSerializer):
    """Serializer for Thread model."""

    class Meta:
        model = Thread
        fields = '__all__'


class MessageSerializer(serializers.ModelSerializer):
    """Serializer for Message model, including sender details and message ownership."""

    sender = UserSerializers()
    is_my_message = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = '__all__'

    def get_is_my_message(self, obj):
        """Check if the message was sent by the current user."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            return obj.sender == request.user
        return False


class CommunitySerializer(serializers.ModelSerializer):
    """Serializer for Community model, including participants and joined status."""

    participants = UserSerializers(many=True)
    is_joined = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = '__all__'

    def get_is_joined(self, obj):
        """Check if the current user is a participant in the community."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            return user in obj.participants.all()
        return False


class CreateCommunitySerializer(serializers.ModelSerializer):
    """Serializer for creating a new Community."""

    class Meta:
        model = Community
        fields = ['name', 'description', 'banner', 'max_participants']


class JoinCommunitySerializer(serializers.ModelSerializer):
    """Serializer for joining a Community."""

    class Meta:
        model = Community
        fields = ['id']

    def save(self, **kwargs):
        """Add the user to the community participants when joining."""
        print('Joining community...')
        community = self.instance
        request = self.context.get('request')
        if request:
            user = request.user
            community.add_participant(user)


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    class Meta:
        model = Notification
        fields = '__all__'


class LiveClassSerializer(serializers.ModelSerializer):
    """Serializer for LiveClass model."""
    tutor = serializers.PrimaryKeyRelatedField(read_only=True)
    tutor_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = LiveClass
        fields = ['id', 'tutor', 'tutor_name', 'title', 'topic', 'jitsi_link', 'created_at', 'is_active']
        read_only_fields = ['id', 'tutor', 'tutor_name', 'created_at']

    def get_tutor_name(self, obj):
        return obj.tutor.username if obj.tutor else None
