import bcrypt from 'bcryptjs';
import { pool, testConnection } from '../src/config/database.js';

const ADMIN = {
  username: 'admin',
  email: 'admin@shadowsofmelody.com',
  password: 'Admin@123456'
};

async function main() {
  await testConnection();

  const hash = await bcrypt.hash(ADMIN.password, 10);

  const [rows] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, is_admin, is_verified)
     VALUES (?, ?, ?, ?, TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE SET is_admin = TRUE, is_verified = TRUE
     RETURNING id, username, email, is_admin`,
    [ADMIN.username, ADMIN.email, hash, ADMIN.full_name]
  );

  const user = rows[0];
  console.log('\n✔ Admin user ready:', user);

  // Ensure subscription row exists for admin user
  await pool.query(
    `INSERT INTO subscriptions (user_id, subscription_type, start_date, end_date)
     VALUES (?, 'free', NOW(), NULL)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );

  console.log('\n=== Admin Login Credentials ===');
  console.log('  Email   :', ADMIN.email);
  console.log('  Password:', ADMIN.password);
  console.log('===============================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
