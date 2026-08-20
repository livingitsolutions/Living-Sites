CREATE SCHEMA IF NOT EXISTS app_security;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.setting(name text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting(name, true), '')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.is_internal()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(app_security.setting('app.context_mode') = 'internal', false)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.is_public()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(app_security.setting('app.context_mode') = 'public', false)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.is_directory()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(app_security.setting('app.context_mode') = 'directory', false)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.is_authorized_tenant()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    app_security.setting('app.context_mode') = 'tenant'
    AND app_security.setting('app.tenant_authorized') = 'true',
    false
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT app_security.setting('app.user_id')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT app_security.setting('app.organization_id')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.website_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT app_security.setting('app.website_id')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.website_scope_matches(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_security.website_id() IS NULL OR app_security.website_id() = candidate
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_security.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_super_admins
    WHERE user_id = app_security.user_id()
  )
$$;
--> statement-breakpoint

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites FORCE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages FORCE ROW LEVEL SECURITY;
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE page_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE application_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_outbox FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY organizations_select_policy ON organizations
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND id = app_security.organization_id())
  OR (
    app_security.is_directory()
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.organization_id = organizations.id
        AND memberships.user_id = app_security.user_id()
        AND memberships.status = 'active'
        AND memberships.deleted_at IS NULL
    )
  )
);
--> statement-breakpoint
CREATE POLICY organizations_insert_policy ON organizations
FOR INSERT
WITH CHECK (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint
CREATE POLICY organizations_update_policy ON organizations
FOR UPDATE
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND id = app_security.organization_id())
)
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND id = app_security.organization_id())
);
--> statement-breakpoint
CREATE POLICY organizations_delete_policy ON organizations
FOR DELETE
USING (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint

CREATE POLICY memberships_select_policy ON memberships
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_directory()
    AND user_id = app_security.user_id()
    AND status = 'active'
    AND deleted_at IS NULL
  )
  OR (
    app_security.setting('app.context_mode') = 'tenant'
    AND organization_id = app_security.organization_id()
    AND (
      app_security.setting('app.tenant_authorized') = 'true'
      OR (
        user_id = app_security.user_id()
        AND status = 'active'
        AND deleted_at IS NULL
        AND (website_scope_id IS NULL OR website_scope_id = app_security.website_id())
      )
    )
  )
);
--> statement-breakpoint
CREATE POLICY memberships_insert_policy ON memberships
FOR INSERT
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND organization_id = app_security.organization_id())
);
--> statement-breakpoint
CREATE POLICY memberships_update_policy ON memberships
FOR UPDATE
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND organization_id = app_security.organization_id())
)
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND organization_id = app_security.organization_id())
);
--> statement-breakpoint
CREATE POLICY memberships_delete_policy ON memberships
FOR DELETE
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (app_security.is_authorized_tenant() AND organization_id = app_security.organization_id())
);
--> statement-breakpoint

CREATE POLICY websites_select_policy ON websites
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(id)
  )
  OR (app_security.is_public() AND status = 'published' AND archived_at IS NULL)
);
--> statement-breakpoint
CREATE POLICY websites_insert_policy ON websites
FOR INSERT
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(id)
  )
);
--> statement-breakpoint
CREATE POLICY websites_update_policy ON websites
FOR UPDATE
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(id)
  )
)
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(id)
  )
);
--> statement-breakpoint
CREATE POLICY websites_delete_policy ON websites
FOR DELETE
USING (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint

CREATE POLICY pages_select_policy ON pages
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = pages.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
  OR (
    app_security.is_public()
    AND status = 'published'
    AND archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = pages.website_id
        AND websites.status = 'published'
        AND websites.archived_at IS NULL
    )
  )
);
--> statement-breakpoint
CREATE POLICY pages_mutation_policy ON pages
FOR ALL
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = pages.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
)
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = pages.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
);
--> statement-breakpoint

CREATE POLICY page_sections_select_policy ON page_sections
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = page_sections.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
);
--> statement-breakpoint
CREATE POLICY page_sections_mutation_policy ON page_sections
FOR ALL
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = page_sections.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
)
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = page_sections.website_id
        AND websites.organization_id = app_security.organization_id()
        AND app_security.website_scope_matches(websites.id)
    )
  )
);
--> statement-breakpoint

CREATE POLICY page_snapshots_select_policy ON page_snapshots
FOR SELECT
USING (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(website_id)
  )
  OR (
    app_security.is_public()
    AND EXISTS (
      SELECT 1
      FROM pages
      JOIN websites ON websites.id = pages.website_id
      WHERE pages.published_snapshot_id = page_snapshots.id
        AND pages.status = 'published'
        AND pages.archived_at IS NULL
        AND websites.status = 'published'
        AND websites.archived_at IS NULL
    )
  )
);
--> statement-breakpoint
CREATE POLICY page_snapshots_insert_policy ON page_snapshots
FOR INSERT
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND app_security.website_scope_matches(website_id)
  )
);
--> statement-breakpoint
CREATE POLICY page_snapshots_update_policy ON page_snapshots
FOR UPDATE
USING (app_security.is_internal() OR app_security.is_platform_super_admin())
WITH CHECK (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint
CREATE POLICY page_snapshots_delete_policy ON page_snapshots
FOR DELETE
USING (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint

CREATE POLICY application_outbox_select_policy ON application_outbox
FOR SELECT
USING (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint
CREATE POLICY application_outbox_insert_policy ON application_outbox
FOR INSERT
WITH CHECK (
  app_security.is_internal()
  OR app_security.is_platform_super_admin()
  OR (
    app_security.is_authorized_tenant()
    AND organization_id = app_security.organization_id()
    AND (website_id IS NULL OR app_security.website_scope_matches(website_id))
  )
);
--> statement-breakpoint
CREATE POLICY application_outbox_update_policy ON application_outbox
FOR UPDATE
USING (app_security.is_internal() OR app_security.is_platform_super_admin())
WITH CHECK (app_security.is_internal() OR app_security.is_platform_super_admin());
--> statement-breakpoint
CREATE POLICY application_outbox_delete_policy ON application_outbox
FOR DELETE
USING (app_security.is_internal() OR app_security.is_platform_super_admin());
