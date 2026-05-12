-- 007_support_reviews_sos.sql

-- Support, Reviews & SOS: support_tickets, support_messages, reviews, review_responses, rating_summaries, sos_alerts, emergency_contacts

-- Generated from live DB schema


-- ============================================================
-- Table: support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL NOT NULL,
    ticket_number VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    ride_id INTEGER,
    category VARCHAR(30) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'medium' NOT NULL,
    status VARCHAR(20) DEFAULT 'open' NOT NULL,
    assigned_to UUID,
    assigned_at TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_tickets_category_check CHECK (((category)::text = ANY ((ARRAY['ride_issue'::character varying, 'payment_issue'::character varying, 'driver_behavior'::character varying, 'safety_concern'::character varying, 'app_bug'::character varying, 'account'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT support_tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT support_tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'waiting_on_user'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
    CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number),
    CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id),
    CONSTRAINT support_tickets_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE SET NULL,
    CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets USING btree (assigned_to) WHERE (assigned_to IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets USING btree (priority, created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ride ON public.support_tickets USING btree (ride_id) WHERE (ride_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets USING btree (status) WHERE ((status)::text <> ALL ((ARRAY['resolved'::character varying, 'closed'::character varying])::text[]));

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_ticket_number_key ON public.support_tickets USING btree (ticket_number);

-- ============================================================
-- Table: support_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL NOT NULL,
    ticket_id INTEGER NOT NULL,
    sender_id UUID NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    attachments TEXT[] DEFAULT '{}'::text[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_messages_sender_role_check CHECK (((sender_role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT support_messages_pkey PRIMARY KEY (id),
    CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages USING btree (ticket_id, created_at);

-- ============================================================
-- Table: reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    reviewer_type VARCHAR(10) NOT NULL,
    reviewee_type VARCHAR(10) NOT NULL,
    rating DECIMAL(2,1) NOT NULL,
    comment TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    tip_amount DECIMAL(10,2) DEFAULT 0,
    is_visible BOOLEAN DEFAULT TRUE NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_rating_check CHECK (((rating >= (1)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT reviews_reviewee_type_check CHECK (((reviewee_type)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying])::text[]))),
    CONSTRAINT reviews_reviewer_type_check CHECK (((reviewer_type)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying])::text[]))),
    CONSTRAINT reviews_pkey PRIMARY KEY (id),
    CONSTRAINT reviews_ride_id_reviewer_id_reviewee_id_key UNIQUE (ride_id, reviewer_id, reviewee_id),
    CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT reviews_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews USING btree (rating);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews USING btree (reviewee_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews USING btree (reviewer_id);

CREATE INDEX IF NOT EXISTS idx_reviews_ride_id ON public.reviews USING btree (ride_id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_ride_id_reviewer_id_reviewee_id_key ON public.reviews USING btree (ride_id, reviewer_id, reviewee_id);

-- ============================================================
-- Table: review_responses
-- ============================================================
CREATE TABLE IF NOT EXISTS review_responses (
    id SERIAL NOT NULL,
    review_id INTEGER NOT NULL,
    responder_id UUID NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT review_responses_pkey PRIMARY KEY (id),
    CONSTRAINT review_responses_review_id_key UNIQUE (review_id),
    CONSTRAINT review_responses_responder_id_fkey FOREIGN KEY (responder_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT review_responses_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS review_responses_review_id_key ON public.review_responses USING btree (review_id);

-- ============================================================
-- Table: rating_summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS rating_summaries (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    user_type VARCHAR(10) NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0 NOT NULL,
    total_reviews INTEGER DEFAULT 0 NOT NULL,
    five_star INTEGER DEFAULT 0 NOT NULL,
    four_star INTEGER DEFAULT 0 NOT NULL,
    three_star INTEGER DEFAULT 0 NOT NULL,
    two_star INTEGER DEFAULT 0 NOT NULL,
    one_star INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rating_summaries_user_type_check CHECK (((user_type)::text = ANY ((ARRAY['passenger'::character varying, 'driver'::character varying])::text[]))),
    CONSTRAINT rating_summaries_pkey PRIMARY KEY (id),
    CONSTRAINT rating_summaries_user_id_key UNIQUE (user_id),
    CONSTRAINT rating_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rating_summaries_uid ON public.rating_summaries USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS rating_summaries_user_id_key ON public.rating_summaries USING btree (user_id);

-- ============================================================
-- Table: sos_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS sos_alerts (
    id SERIAL NOT NULL,
    ride_id INTEGER NOT NULL,
    triggered_by UUID NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'triggered' NOT NULL,
    admin_notes TEXT,
    resolved_by UUID,
    resolved_at TIMESTAMP,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sos_alerts_status_check CHECK (((status)::text = ANY ((ARRAY['triggered'::character varying, 'contacts_notified'::character varying, 'admin_reviewed'::character varying, 'resolved'::character varying, 'false_alarm'::character varying])::text[]))),
    CONSTRAINT sos_alerts_pkey PRIMARY KEY (id),
    CONSTRAINT sos_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id),
    CONSTRAINT sos_alerts_ride_id_fkey FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    CONSTRAINT sos_alerts_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_ride ON public.sos_alerts USING btree (ride_id);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON public.sos_alerts USING btree (status) WHERE ((status)::text <> 'resolved'::text);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_user ON public.sos_alerts USING btree (triggered_by);

-- ============================================================
-- Table: emergency_contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    relationship VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id),
    CONSTRAINT emergency_contacts_user_id_phone_key UNIQUE (user_id, phone),
    CONSTRAINT emergency_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS emergency_contacts_user_id_phone_key ON public.emergency_contacts USING btree (user_id, phone);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON public.emergency_contacts USING btree (user_id);
