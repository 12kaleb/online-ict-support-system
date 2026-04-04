-- Enable RLS on Profile table
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own profile
CREATE POLICY "Users can only read their own profile" ON "Profile"
  FOR SELECT
  USING (auth.uid()::text = id);

-- Policy: Users can only insert their own profile (needed for signup)
CREATE POLICY "Users can only insert their own profile" ON "Profile"
  FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- Policy: Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON "Profile"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Profile"
      WHERE id = auth.uid()::text AND role = 'admin'
    )
  );

-- Policy: Admins can insert any profile (needed for admin user creation)
CREATE POLICY "Admins can insert any profile" ON "Profile"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Profile"
      WHERE id = auth.uid()::text AND role = 'admin'
    )
  );

-- Policy: Admins can update any profile
CREATE POLICY "Admins can update any profile" ON "Profile"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "Profile"
      WHERE id = auth.uid()::text AND role = 'admin'
    )
  );
