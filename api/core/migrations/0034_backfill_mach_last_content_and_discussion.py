# Generated manually on 2026-09-08

from django.db import migrations


def backfill_last_content_and_discussion(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE core_mach m
            SET last_content_at = GREATEST(
                m.published_at,
                COALESCE(
                    (
                        SELECT MAX(moc.created_at)
                        FROM core_moc moc
                        WHERE moc.mach_id = m.id
                          AND moc.deleted_at IS NULL
                          AND moc.hidden_at IS NULL
                    ),
                    m.published_at
                )
            ),
            last_discussion_at = GREATEST(
                m.published_at,
                COALESCE(
                    (
                        SELECT MAX(c.created_at)
                        FROM core_comment c
                        WHERE c.mach_id = m.id
                          AND c.deleted_at IS NULL
                          AND c.hidden_at IS NULL
                    ),
                    m.published_at
                )
            );
            """
        )


def khong_lam_gi(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0033_remove_mach_mach_open_last_entry_and_more"),
    ]

    operations = [
        migrations.RunPython(
            backfill_last_content_and_discussion,
            reverse_code=khong_lam_gi,
        ),
    ]
