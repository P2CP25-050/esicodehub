import uuid
from django.db import migrations

def populate_public_ids(apps, _schema_editor):
    User = apps.get_model('accounts', 'User')
    for user in User.objects.filter(public_id__isnull=True):
        user.public_id = uuid.uuid4()
        user.save(update_fields=['public_id'])

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_public_id'),
    ]

    operations = [
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
    ]