from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_fix_user_table_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE accounts_user DROP COLUMN IF EXISTS username;",
            reverse_sql="ALTER TABLE accounts_user ADD COLUMN IF NOT EXISTS username varchar(150) NULL;",
        ),
    ]
