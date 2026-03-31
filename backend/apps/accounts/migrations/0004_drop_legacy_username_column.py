from django.db import migrations


def _forward(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("ALTER TABLE accounts_user DROP COLUMN IF EXISTS username;")


def _backward(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("ALTER TABLE accounts_user ADD COLUMN IF NOT EXISTS username varchar(150) NULL;")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_fix_user_table_columns'),
    ]

    operations = [
        migrations.RunPython(_forward, _backward),
    ]
