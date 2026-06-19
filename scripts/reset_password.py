"""重置用户密码脚本"""
import sqlite3
from passlib.context import CryptContext

# 初始化密码哈希上下文（与后端一致）
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 要重置的邮箱和新密码
TARGET_EMAIL = "21749959@qq.com"
NEW_PASSWORD = "stem2026"  # 新密码

# 生成新密码的哈希
new_hash = pwd_context.hash(NEW_PASSWORD)
print(f"新密码: {NEW_PASSWORD}")
print(f"新哈希: {new_hash}")

# 更新数据库
conn = sqlite3.connect('D:/data/finestem/finestem.db')
cur = conn.cursor()

cur.execute(
    "UPDATE users SET hashed_password = ?, updated_at = datetime('now') WHERE email = ?",
    (new_hash, TARGET_EMAIL)
)

if cur.rowcount > 0:
    print(f"\n✅ 密码重置成功！用户 {TARGET_EMAIL} 的新密码为: {NEW_PASSWORD}")
else:
    print(f"\n❌ 未找到用户 {TARGET_EMAIL}")

conn.commit()
conn.close()
