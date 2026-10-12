"""密码哈希与校验（R12：bcrypt 存储）。

PR-3 在此接入管理员账号创建与登录 / 登出 / 改密；会话载体为签名 Cookie，
不使用模板的 JWT 访问令牌机制，故本模块只保留密码哈希面。
"""

from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

password_hash = PasswordHash((BcryptHasher(),))


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)
