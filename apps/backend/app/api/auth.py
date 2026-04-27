"""
用户认证 API 路由

用途：注册、登录、获取当前用户信息
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from datetime import datetime, timedelta
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

from app.schemas.auth import (
    User,
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    AuthResponse,
)
from app.schemas.common import ApiResponse
from app.repositories.runtime_db import db
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["认证"])

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 密码承载者令牌
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# JWT 配置
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


class LightRegisterRequest(BaseModel):
    name: str = Field(default="同学", min_length=1, max_length=30)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.get_user(user_id)
    if user is None:
        raise credentials_exception
    
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        level=user.level,
        capability_tags=user.capability_tags,
        created_at=user.created_at,
    )


async def get_optional_current_user(token: str | None = Depends(oauth2_scheme_optional)) -> UserResponse | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
    except JWTError:
        return None
    if not user_id:
        return None
    user = db.get_user(user_id)
    if user is None:
        return None
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        level=user.level,
        capability_tags=user.capability_tags,
        created_at=user.created_at,
    )


@router.post("/register", response_model=ApiResponse[AuthResponse])
async def register(user_data: UserCreate):
    """
    用户注册
    """
    # 检查邮箱是否已注册
    existing_user = db.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册",
        )
    
    # 创建用户
    hashed_password = get_password_hash(user_data.password)
    user = User(
        id=str(uuid.uuid4()),
        name=user_data.name,
        email=user_data.email,
        password=hashed_password,  # Note: real schema should have password field
        role="student",
        level=1,
        capability_tags=[],
        created_by="system",
    )
    
    created_user = db.create_user(user)
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": created_user.id},
        expires_delta=access_token_expires,
    )
    
    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=created_user.id,
                name=created_user.name,
                email=created_user.email,
                role=created_user.role,
                level=created_user.level,
                capability_tags=created_user.capability_tags,
                created_at=created_user.created_at,
            ),
            access_token=access_token,
            token_type="bearer",
        ),
        message="注册成功",
    )


@router.post("/light-register", response_model=ApiResponse[AuthResponse])
async def light_register(req: LightRegisterRequest):
    """
    轻注册（匿名升级）
    """
    suffix = uuid.uuid4().hex[:10]
    email = f"light_{suffix}@finestem.local"
    temp_password = get_password_hash(uuid.uuid4().hex)
    user = User(
        id=str(uuid.uuid4()),
        name=req.name,
        email=email,
        password=temp_password,
        role="student",
        level=1,
        capability_tags=[],
        created_by="system",
    )
    created_user = db.create_user(user)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": created_user.id},
        expires_delta=access_token_expires,
    )
    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=created_user.id,
                name=created_user.name,
                email=created_user.email,
                role=created_user.role,
                level=created_user.level,
                capability_tags=created_user.capability_tags,
                created_at=created_user.created_at,
            ),
            access_token=access_token,
            token_type="bearer",
        ),
        message="轻注册成功",
    )


@router.post("/login", response_model=ApiResponse[AuthResponse])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    用户登录
    """
    # 查找用户
    user = db.get_user_by_email(form_data.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 验证密码
    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id},
        expires_delta=access_token_expires,
    )
    
    return ApiResponse(
        data=AuthResponse(
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
                level=user.level,
                capability_tags=user.capability_tags,
                created_at=user.created_at,
            ),
            access_token=access_token,
            token_type="bearer",
        ),
        message="登录成功",
    )


@router.get("/me", response_model=ApiResponse[UserResponse])
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """
    获取当前用户信息
    """
    return ApiResponse(data=current_user, message="获取成功")


@router.patch("/me", response_model=ApiResponse[UserResponse])
async def update_current_user_info(
    user_update: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    更新当前用户信息
    """
    update_data = user_update.model_dump(exclude_unset=True)
    updated_user = db.update_user(current_user.id, update_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    return ApiResponse(
        data=UserResponse(
            id=updated_user.id,
            name=updated_user.name,
            email=updated_user.email,
            role=updated_user.role,
            level=updated_user.level,
            capability_tags=updated_user.capability_tags,
            created_at=updated_user.created_at,
        ),
        message="更新成功",
    )
