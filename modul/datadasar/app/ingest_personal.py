import csv
import mysql.connector as mdb
import sys
from dotenv import load_dotenv
import os

# Get Envi
load_dotenv('.env')

dbhost = os.environ['DB_INTI_HOST']
dbport = os.environ['DB_INTI_PORT']
dbuser = os.environ['DB_INTI_USER']
dbpass = os.environ['DB_INTI_PASS']
dbname = os.environ['DB_INTI_NAME']

tabel=sys.argv[1]

conn = mdb.connect(host=dbhost, user=dbuser, password=dbpass, db=dbname, port=dbport)
mycur = conn.cursor(buffered=True)

with open('files/'+tabel+'.csv') as cesve:
    csv_reader = csv.reader(cesve, delimiter=';')
    next(csv_reader)
    sql = "call inti.tambah_personal(%s,%s,%s,%s,%s,%s,%s,%s,%s)"
    mycur.executemany(sql, csv_reader)
    conn.commit()
    
conn.close()
