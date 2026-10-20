#! /usr/bin/env bash

set -e
set -x

# 配置校验（管理员环境变量 + R12 密码策略，失败中文原因）+ 等待数据库就绪
python app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB（幂等：既有管理员不覆盖密码，Owner 不重复）
python app/initial_data.py
