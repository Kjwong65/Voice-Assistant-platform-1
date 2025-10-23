-- ==============================================
-- VOICE ASSISTANT PLATFORM - DATABASE SCHEMA
-- PostgreSQL + pgvector
-- ==============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ==============================================
-- TENANTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    openai_key TEXT,
    settings JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(active);

-- ==============================================
-- USERS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash TEXT,
    role VARCHAR(50) DEFAULT 'user',
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ==============================================
-- SESSIONS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) DEFAULT 'web',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    turn_count INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);

-- ==============================================
-- CONVERSATIONS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    audio_url TEXT,
    metadata JSONB DEFAULT '{}',
    citations JSONB,
    function_calls JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);

-- ==============================================
-- DOCUMENTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    chunk_count INTEGER DEFAULT 0
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_uploaded ON documents(uploaded_at DESC);

-- ==============================================
-- DOCUMENT CHUNKS TABLE (with pgvector)
-- ==============================================
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    page_number INTEGER,
    section_title TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ==============================================
-- ANALYTICS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_tenant ON analytics(tenant_id);
CREATE INDEX idx_analytics_session ON analytics(session_id);
CREATE INDEX idx_analytics_event ON analytics(event_type);
CREATE INDEX idx_analytics_timestamp ON analytics(timestamp DESC);

-- ==============================================
-- API USAGE TABLE (for billing/monitoring)
-- ==============================================
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost DECIMAL(10, 6) DEFAULT 0,
    duration_ms INTEGER,
    status VARCHAR(50),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant ON api_usage(tenant_id);
CREATE INDEX idx_usage_service ON api_usage(service);
CREATE INDEX idx_usage_timestamp ON api_usage(timestamp DESC);

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_chunks(
    query_embedding vector(1536),
    tenant_filter UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    page_number INTEGER,
    section_title TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) as similarity,
        dc.metadata,
        dc.page_number,
        dc.section_title
    FROM document_chunks dc
    WHERE dc.tenant_id = tenant_filter
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ==============================================
-- SEED DATA (Demo Tenant)
-- ==============================================

INSERT INTO tenants (id, name, slug, api_key, settings)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Demo Tenant',
    'demo',
    'demo-api-key-change-me',
    '{"features": {"rag": true, "streaming": true, "barge_in": true}}'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (tenant_id, email, name, role)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin@demo.com',
    'Demo Admin',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ==============================================
-- VIEWS
-- ==============================================

-- View for session statistics
CREATE OR REPLACE VIEW session_stats AS
SELECT
    s.tenant_id,
    COUNT(DISTINCT s.id) as total_sessions,
    AVG(s.duration_seconds) as avg_duration_seconds,
    AVG(s.turn_count) as avg_turns_per_session,
    COUNT(c.id) as total_messages,
    DATE(s.started_at) as date
FROM sessions s
LEFT JOIN conversations c ON s.id = c.session_id
GROUP BY s.tenant_id, DATE(s.started_at);

-- View for document processing status
CREATE OR REPLACE VIEW document_status_summary AS
SELECT
    tenant_id,
    status,
    COUNT(*) as document_count,
    SUM(file_size) as total_size,
    SUM(chunk_count) as total_chunks
FROM documents
GROUP BY tenant_id, status;

-- ==============================================
-- GRANTS (for application user)
-- ==============================================

-- Create application user if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'voice_assistant_app') THEN
        CREATE USER voice_assistant_app WITH PASSWORD 'app_password_change_me';
    END IF;
END
$$;

-- Grant permissions
GRANT CONNECT ON DATABASE voice_assistant TO voice_assistant_app;
GRANT USAGE ON SCHEMA public TO voice_assistant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO voice_assistant_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO voice_assistant_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO voice_assistant_app;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Voice Assistant Platform database initialized successfully!';
    RAISE NOTICE '   - Tables created with pgvector support';
    RAISE NOTICE '   - Indexes optimized for performance';
    RAISE NOTICE '   - Demo tenant seeded';
    RAISE NOTICE '   - Ready for development';
END
$$;
