from pydantic import BaseModel

class Personal(BaseModel):
    nik: str
    nama: str
    gender: str
    tanggal_lahir: int
    tempat_lahir: str
    alamat_ktp: str
    alamat_domisili: str
    pekerjaan: str
    created_at: int
    created_by: int

