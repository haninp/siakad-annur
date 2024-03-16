import shutil
import subprocess
import secrets
import os, sys
from dotenv import load_dotenv

from typing import List
from fastapi import Depends, status, FastAPI, HTTPException, File, Body
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.datastructures import UploadFile
from fastapi.responses import FileResponse

import schemas

load_dotenv('.env')

uname = os.environ['DEFAULT_USER']
passw = os.environ['DEFAULT_PASS']

description = """
## Features:
* Download file template *.csv
* Import file *.csv

## Release Notes:
* Initial release Syawwal 1444 H | April 2023
"""

app = FastAPI(
    title="Modul Data Dasar",
    version="0.0",
    description=description,
    contact={
        "name": "Hani Perkasa",
        "email": "haninurchairilp@gmail.com",
        "url": "https://www.linkedin.com/in/haninp/"
    },
    redoc_url=None,
    docs_url="/read/me",
)

security = HTTPBasic()

def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, uname)
    correct_password = secrets.compare_digest(credentials.password, passw)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/")
def home(username: str = Depends(get_current_username)):
    return {"Status": "Online"}

@app.get("/download/template/{file_name}", tags=['template'])
async def get_template(file_name: str):
    # file = {"file_name": file_name}
    file_path = "template/"+file_name+".csv"
    response = FileResponse(file_path, media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename="+file_name+".csv"
    return response

@app.post("/crud/personal/add/", tags=['crud'])
async def add_personal(
    personal:schemas.Personal = Body(..., embed=True),
    username: str = Depends(get_current_username)
):
    return personal
    
@app.post("/files/upload", tags=['ingestion'])
async def upload_files(files: List[UploadFile] = File(...), username: str = Depends(get_current_username)):
    for fle in files:
        if os.path.isfile('files/'+fle.filename):
            raise HTTPException(status_code=500, detail=fle.filename+" was exists"); sys.exit()
        else:
            with open(f'files/{fle.filename}', 'ab') as buffer:
                shutil.copyfileobj(fle.file, buffer)
    return {"status": "Upload Success"}

@app.post("/files/import/personal/{file_name}", tags=['ingestion'])
async def import_personal(file_name: str, username: str = Depends(get_current_username)):
    file = {"file_name": file_name}
    subprocess.call(['python3 ingest_personal.py '+file_name], shell=True)
    return {print(file_name)}

@app.post("/files/import/pengajar/{file_name}", tags=['ingestion'])
async def import_pengajar(file_name: str, username: str = Depends(get_current_username)):
    file = {"file_name": file_name}
    subprocess.call(['python3 ingest_pengajar.py '+file_name], shell=True)
    return {print(file_name)}

@app.get("/files/clear", tags=['ingestion'])
async def clear_files(username: str = Depends(get_current_username)):
    subprocess.call(['rm -rf files/*.*'], shell=True)
    return {"status": "Clear Success"}
