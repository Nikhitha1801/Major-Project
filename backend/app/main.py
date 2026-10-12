from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import (
    auth, users, departments, academics, attendance, dashboard, reports, face,
    swaps, classrooms, audit, settings, camera,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Attendify API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Allow localhost/127.0.0.1 plus any private LAN IP (10.x, 172.16-31.x, 192.168.x)
    # so the app also works when opened from another device on the same network.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(academics.router)
app.include_router(attendance.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(face.router)
app.include_router(swaps.router)
app.include_router(classrooms.router)
app.include_router(audit.router)
app.include_router(settings.router)
app.include_router(camera.router)


@app.get("/")
def root():
    return {"status": "Attendify API is running"}
