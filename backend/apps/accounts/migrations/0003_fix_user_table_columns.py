from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_subject_emailverification_profile'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE accounts_user
                ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'student';

                ALTER TABLE accounts_user
                ADD COLUMN IF NOT EXISTS school_id varchar(20) NOT NULL DEFAULT '';

                ALTER TABLE accounts_user
                ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

                ALTER TABLE accounts_user
                ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();
            """,
            reverse_sql="""
                ALTER TABLE accounts_user DROP COLUMN IF EXISTS created_at;
                ALTER TABLE accounts_user DROP COLUMN IF EXISTS is_verified;
                ALTER TABLE accounts_user DROP COLUMN IF EXISTS school_id;
                ALTER TABLE accounts_user DROP COLUMN IF EXISTS role;
            """,
        ),
    ]
