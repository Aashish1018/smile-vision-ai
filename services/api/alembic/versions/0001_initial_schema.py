"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-11-03 00:38:05.592577

"""
from typing import Sequence, Union

from alembic import op
import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table('knowledge_chunks',
    sa.Column('id', sa.String(length=160), nullable=False),
    sa.Column('doc_slug', sa.String(length=96), nullable=False),
    sa.Column('doc_title', sa.String(length=200), nullable=False),
    sa.Column('heading', sa.String(length=200), nullable=False),
    sa.Column('ordinal', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('contextual_content', sa.Text(), nullable=False),
    sa.Column('sources', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=384), nullable=False),
    sa.Column('tsv', postgresql.TSVECTOR(), sa.Computed("to_tsvector('english', contextual_content)", persisted=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_chunks_doc_slug'), 'knowledge_chunks', ['doc_slug'], unique=False)
    op.create_index('ix_knowledge_chunks_embedding_hnsw', 'knowledge_chunks', ['embedding'], unique=False, postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})
    op.create_index('ix_knowledge_chunks_tsv', 'knowledge_chunks', ['tsv'], unique=False, postgresql_using='gin')
    op.create_table('llm_calls',
    sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('operation', sa.String(length=64), nullable=False),
    sa.Column('provider', sa.String(length=32), nullable=False),
    sa.Column('model', sa.String(length=96), nullable=False),
    sa.Column('latency_ms', sa.Integer(), nullable=False),
    sa.Column('ok', sa.Boolean(), nullable=False),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('repairs', sa.Integer(), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_llm_calls_created_at'), 'llm_calls', ['created_at'], unique=False)
    op.create_index(op.f('ix_llm_calls_operation'), 'llm_calls', ['operation'], unique=False)
    op.create_table('profiles',
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('role', sa.String(length=16), nullable=False),
    sa.Column('clinic_slug', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('scans',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('owner_id', sa.String(length=64), nullable=False),
    sa.Column('clinic_slug', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('original_key', sa.String(length=256), nullable=False),
    sa.Column('preview_key', sa.String(length=256), nullable=True),
    sa.Column('preview_applied', sa.Boolean(), nullable=False),
    sa.Column('findings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('scores', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('triage', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('model_meta', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('share_token', sa.String(length=64), nullable=True),
    sa.Column('shared_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('share_token')
    )
    op.create_index(op.f('ix_scans_clinic_slug'), 'scans', ['clinic_slug'], unique=False)
    op.create_index(op.f('ix_scans_created_at'), 'scans', ['created_at'], unique=False)
    op.create_index(op.f('ix_scans_owner_id'), 'scans', ['owner_id'], unique=False)
    op.create_table('care_plans',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('scan_id', sa.UUID(), nullable=False),
    sa.Column('thread_id', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=24), nullable=False),
    sa.Column('draft', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('estimate', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('evidence', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('path', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('reviewer_id', sa.String(length=64), nullable=True),
    sa.Column('review_notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['scan_id'], ['scans.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('scan_id')
    )
    op.create_index(op.f('ix_care_plans_status'), 'care_plans', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_care_plans_status'), table_name='care_plans')
    op.drop_table('care_plans')
    op.drop_index(op.f('ix_scans_owner_id'), table_name='scans')
    op.drop_index(op.f('ix_scans_created_at'), table_name='scans')
    op.drop_index(op.f('ix_scans_clinic_slug'), table_name='scans')
    op.drop_table('scans')
    op.drop_table('profiles')
    op.drop_index(op.f('ix_llm_calls_operation'), table_name='llm_calls')
    op.drop_index(op.f('ix_llm_calls_created_at'), table_name='llm_calls')
    op.drop_table('llm_calls')
    op.drop_index('ix_knowledge_chunks_tsv', table_name='knowledge_chunks', postgresql_using='gin')
    op.drop_index('ix_knowledge_chunks_embedding_hnsw', table_name='knowledge_chunks', postgresql_using='hnsw', postgresql_ops={'embedding': 'vector_cosine_ops'})
    op.drop_index(op.f('ix_knowledge_chunks_doc_slug'), table_name='knowledge_chunks')
    op.drop_table('knowledge_chunks')
