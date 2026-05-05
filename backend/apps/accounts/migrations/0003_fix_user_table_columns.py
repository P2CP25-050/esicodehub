from django.db import migrations


def _forward(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    schema_editor.execute(
        """
        ALTER TABLE accounts_user
        ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'student';
        """
    )
    schema_editor.execute(
        """
        ALTER TABLE accounts_user
        ADD COLUMN IF NOT EXISTS school_id varchar(20) NOT NULL DEFAULT '';
        """
    )
    schema_editor.execute(
        """
        ALTER TABLE accounts_user
        ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
        """
    )
    schema_editor.execute(
        """
        ALTER TABLE accounts_user
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();
        """
    )


def _backward(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return

    schema_editor.execute("ALTER TABLE accounts_user DROP COLUMN IF EXISTS created_at;")
    schema_editor.execute("ALTER TABLE accounts_user DROP COLUMN IF EXISTS is_verified;")
    schema_editor.execute("ALTER TABLE accounts_user DROP COLUMN IF EXISTS school_id;")
    schema_editor.execute("ALTER TABLE accounts_user DROP COLUMN IF EXISTS role;")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_subject_emailverification_profile'),
    ]

    operations = [
        migrations.RunPython(_forward, _backward),
    ]
