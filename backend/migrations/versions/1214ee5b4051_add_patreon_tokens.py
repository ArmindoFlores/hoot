"""Add patreon tokens

Revision ID: 1214ee5b4051
Revises: c79ac4235ef3
Create Date: 2025-03-27 20:16:29.815257

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1214ee5b4051'
down_revision = 'c79ac4235ef3'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('patreon_member', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('patreon_member_last_checked', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('patreon_access_token', sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column('patreon_refresh_token', sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column('patreon_access_token_expiration', sa.DateTime(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('patreon_access_token_expiration')
        batch_op.drop_column('patreon_refresh_token')
        batch_op.drop_column('patreon_access_token')
        batch_op.drop_column('patreon_member_last_checked')
        batch_op.drop_column('patreon_member')

    # ### end Alembic commands ###
