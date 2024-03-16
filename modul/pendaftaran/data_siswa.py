from array import array
import shutil
import subprocess
import time
import secrets
import os, sys

from typing import List, Optional
from fastapi import Depends, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import FastAPI, HTTPException
from fastapi.datastructures import UploadFile
from fastapi import File

# import pika
import datetime, sys

description = """
## Features:
* Import file .xlsx/.xls

## Release Notes:
* Initial release Jumadal Akhir 1444 H | Januari 2023
"""

app = FastAPI(
    title="Modul Pendataan Siswa",
    version="0.0",
    Status="Online",
    description=description,
    contact={
        "name": "Hani Perkasa",
        "email": "haninurchairilp@gmail.com",
    },
    redoc_url=None,
    docs_url="/read/me",
)

security = HTTPBasic()

def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, "admin")
    correct_password = secrets.compare_digest(credentials.password, "bismillah!@#")
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/")
def home(username: str = Depends(get_current_username)):
    return {
        "Status": "Online"
        }

@app.post("/files/upload", tags=['mail'])
async def upload_files(files: List[UploadFile] = File(...), username: str = Depends(get_current_username)):
    for fle in files:
        if os.path.isfile('files/'+fle.filename):
            raise HTTPException(status_code=500, detail=fle.filename+" was exists"); sys.exit()
        else:
            with open(f'files/{fle.filename}', 'ab') as buffer:
                shutil.copyfileobj(fle.file, buffer)
    return {"status": "Upload Success"}

@app.get("/files/clear", tags=['mail'])
async def clear_files(username: str = Depends(get_current_username)):
    subprocess.call(['rm -rf files/*.*'], shell=True)
    return {"status": "Clear Success"}
