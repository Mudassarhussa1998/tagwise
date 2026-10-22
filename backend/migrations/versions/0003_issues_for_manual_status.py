"""open issues for assets that were set out of service / attention by hand

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-22

Before this, changing an asset's status manually didn't open an issue, so such
assets never appeared on the Issues page. Open one for each of them now.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ISSUES = {"out_of_service": ("high", "Out of service (set manually)"), "attention": ("medium", "Needs attention (set manually)")}


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("""
        SELECT a.id, a.org_id, a.status FROM assets a
        WHERE a.status IN ('out_of_service', 'attention')
          AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.asset_id = a.id AND i.status = 'open')
    """)).all()
    for asset_id, org_id, status in rows:
        severity, title = ISSUES[status]
        params = {"asset": asset_id, "org": org_id, "title": title, "severity": severity}
        conn.execute(sa.text("""
            INSERT INTO issues (asset_id, title, description, severity, status, reported_by, created_at)
            VALUES (:asset, :title, '', :severity, 'open', 'System', now() at time zone 'utc')
        """), params)
        conn.execute(sa.text("""
            INSERT INTO events (asset_id, org_id, kind, level, title, detail, actor, created_at)
            VALUES (:asset, :org, 'issue', CASE WHEN :severity = 'high' THEN 'danger' ELSE 'warn' END,
                    'Issue opened: ' || :title, 'Created for an existing manual status', 'System', now() at time zone 'utc')
        """), params)


def downgrade() -> None:
    # Data-only migration; the issues it opened are kept.
    pass
