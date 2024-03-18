import csv
import mysql.connector

# Koneksi ke database MySQL
database = mysql.connector.connect(
    host="database",
    user="sysadm",
    password="siakad",
    database="inti"
)

# Buat cursor
cursor = database.cursor()

# Buka file CSV
with open("person.csv", "r") as file:
    reader = csv.reader(file, delimiter=",")

    # Lewati header
    next(reader, None)

    # Iterasi setiap baris
    for row in reader:
        nik, full_name, dob, gender, domicile, email, no_hp, id_telegram, is_wali, is_mudarris, is_admin = row

        # Masukkan data ke tabel person
        query = """
            call inti.add_person(%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (nik, full_name.upper(), dob, gender, domicile, "system"))

        # Masukkan data ke tabel wali
        if is_wali == "true":
            query = """
                call inti.add_wali(%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (id_telegram, nik, email, no_hp, "system"))

        # Masukkan data ke tabel mudarris
        if is_mudarris == "true":
            query = """
                call inti.add_mudarrisin(%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (id_telegram, nik, email, no_hp, "system"))

        # Masukkan data ke tabel admin
        if is_admin == "true":
            query = """
                call inti.add_admin(%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (id_telegram, nik, email, no_hp, "system"))

# Simpan perubahan
database.commit()

# Tutup cursor
cursor.close()

# Tutup koneksi database
database.close()
