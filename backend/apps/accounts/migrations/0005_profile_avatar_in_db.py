from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_drop_legacy_username_column'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='avatar_content_type',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='profile',
            name='avatar_data',
            field=models.TextField(blank=True, default=''),
        ),
    ]
