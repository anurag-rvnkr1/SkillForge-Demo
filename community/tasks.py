from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings


@shared_task
def send_join_request_notification(tutor_email, student_username, community_name):
    subject = f'New join request for {community_name}'
    message = f'User {student_username} has requested to join your community: {community_name}. Please review the request in the Tutor dashboard.'
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [tutor_email], fail_silently=True)


@shared_task
def send_join_request_response(student_email, community_name, approved: bool):
    subject = f'Your join request for {community_name} has been {"approved" if approved else "rejected"}'
    if approved:
        message = f'Your request to join {community_name} has been approved. You can now access the community.'
    else:
        message = f'Your request to join {community_name} has been rejected by the tutor.'
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [student_email], fail_silently=True)


@shared_task
def send_removed_notification(student_email, community_name):
    subject = f'You have been removed from {community_name}'
    message = f'You have been removed from {community_name} by the tutor.'
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [student_email], fail_silently=True)
