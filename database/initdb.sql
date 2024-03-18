-- master person
CREATE TABLE inti.person (
	nik varchar(16) NOT NULL PRIMARY KEY COMMENT 'Nomor KTP',
	full_name varchar(100) NOT NULL COMMENT 'Nama lengkap sesuai KTP, bukan kunyah !!',
    dob BIGINT NOT NULL COMMENT 'Tanggal lahir',
    gender ENUM('M','F') NOT NULL COMMENT 'Laki-laki (M) atau Perempuan (F)',
    domicile varchar(100) COMMENT 'Alamat domisili',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- master santri
CREATE TABLE inti.santri (
	nis varchar(5) NOT NULL PRIMARY KEY COMMENT 'Unique ID dari santri ini',
    nik_wali varchar(16) COMMENT 'FK ke table `inti.person`',
    full_name varchar(100) NOT NULL COMMENT 'Nama lengkap, bukan kunyah !!',
    dob BIGINT NOT NULL COMMENT 'Tanggal lahir',
    gender ENUM('M','F') NOT NULL COMMENT 'Laki-laki (M) atau Perempuan (F)',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
	CONSTRAINT santri_person_FK FOREIGN KEY (nik_wali) REFERENCES inti.person(nik)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- master class
CREATE TABLE inti.class (
	id varchar(5) NOT NULL PRIMARY KEY COMMENT 'Unique ID dari kelas, cth: 0A, 3B, 7A, 11A, dst...',
    name varchar(30) NOT NULL COMMENT 'Nama kelas, cth: RA-0A, MI-3B, MT-7A, MA-11A, dst...',
    gender ENUM('M','F') NOT NULL COMMENT 'Laki-laki (M) atau Perempuan (F)',
    year_of_study INT(4) COMMENT 'Tahun ajaran (diisi tahun hijriah)',
    level INT(2) COMMENT 'Level kelas, cth: RA < 1 || 0 < MI < 7 || 6 < MT < 10 || 9 < MA < 13',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- master course
CREATE TABLE inti.course (
	id varchar(5) NOT NULL PRIMARY KEY COMMENT 'Unique ID -> nanoid',
    name varchar(30) NOT NULL COMMENT 'Nama matpel, cth: tajwid, hafalan, dst...',
    year_of_study INT(4) COMMENT 'Tahun ajaran (diisi tahun hijriah)',
    level INT(2) COMMENT 'Level kelas, cth: RA < 1 || 0 < MI < 7 || 6 < MT < 10 || 9 < MA < 13',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- wali
CREATE TABLE inti.wali (
	id varchar(50) NOT NULL PRIMARY KEY COMMENT 'Unique ID menggunakan ID Telegram',
    nik varchar(16) NOT NULL COMMENT 'FK ke table `inti.person`',
	email varchar(100) NULL COMMENT 'Email aktif di HP',
	no_hp varchar(20) NULL COMMENT 'No HP aktif',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
	CONSTRAINT wali_person_FK FOREIGN KEY (nik) REFERENCES inti.person(nik)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- mudarrisin
CREATE TABLE inti.mudarrisin (
	id varchar(50) NOT NULL PRIMARY KEY COMMENT 'Unique ID menggunakan ID Telegram',
    nik varchar(16) NOT NULL COMMENT 'FK ke table `inti.person`',
	email varchar(100) NULL COMMENT 'Email aktif di HP',
	no_hp varchar(20) NULL COMMENT 'No HP aktif',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
	CONSTRAINT mudarrisin_person_FK FOREIGN KEY (nik) REFERENCES inti.person(nik)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- admin
CREATE TABLE inti.admin (
	id varchar(50) NOT NULL PRIMARY KEY COMMENT 'Unique ID menggunakan ID Telegram',
    nik varchar(16) NOT NULL COMMENT 'FK ke table `inti.person`',
	email varchar(100) NULL COMMENT 'Email aktif di HP',
	no_hp varchar(20) NULL COMMENT 'No HP aktif',
	created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
	CONSTRAINT admin_person_FK FOREIGN KEY (nik) REFERENCES inti.person(nik)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- composite class_santri
CREATE TABLE inti.class_santri (
	id varchar(8) NOT NULL PRIMARY KEY COMMENT 'Unique ID -> nanoid',
    class_id varchar(5) NOT NULL COMMENT 'FK ke table `inti.class`',
    santri_nis varchar(5) NOT NULL COMMENT 'FK ke table `inti.santri`',
    created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
    CONSTRAINT class_santri_class_FK FOREIGN KEY (class_id) REFERENCES inti.class(id),
    CONSTRAINT class_santri_santri_FK FOREIGN KEY (santri_nis) REFERENCES inti.santri(nis)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- composite class_mudarrisin
CREATE TABLE inti.class_mudarrisin (
	id varchar(8) NOT NULL PRIMARY KEY COMMENT 'Unique ID -> nanoid',
    class_id varchar(5) NOT NULL COMMENT 'FK ke table `inti.class`',
    mudarrisin_id varchar(50) NOT NULL COMMENT 'FK ke table `inti.person`',
    is_wali_kelas BOOL DEFAULT False NOT NULL COMMENT 'TRUE jika mudarris ini wali kelas tertentu',
    course_id varchar(5) NOT NULL COMMENT 'FK ke table `inti.course`',
    created_at BIGINT NOT NULL COMMENT 'waktu dimana row dibuat',
	created_by varchar(50) NOT NULL COMMENT 'ID user (atau NIK) yang membuat row',
	updated_at BIGINT NULL COMMENT 'waktu dimana row diupdate',
	updated_by varchar(50) NULL COMMENT 'ID user (atau NIK) yang merubah row',
	is_deleted BOOL DEFAULT False NOT NULL,
    CONSTRAINT class_mudarrisin_class_FK FOREIGN KEY (class_id) REFERENCES inti.class(id),
    CONSTRAINT class_mudarrisin_person_FK FOREIGN KEY (mudarrisin_id) REFERENCES inti.mudarrisin(id),
    CONSTRAINT class_mudarrisin_course_FK FOREIGN KEY (course_id) REFERENCES inti.course(id)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_0900_ai_ci;

-- func add_person
DELIMITER $$
CREATE PROCEDURE inti.add_person(
    nik varchar(16),
    full_name varchar(100),
    dob varchar(10),
    gender varchar(1),
    domicile varchar(200),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.person(
    nik,
    full_name,
    dob,
    gender,
    domicile,
    created_at,
    created_by) 
values(
    nik,
    full_name,
    unix_timestamp(dob),
    gender,
    domicile,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_santri
DELIMITER $$
CREATE PROCEDURE inti.add_santri(
    nis varchar(5),
	nik_wali varchar(16),
    full_name varchar(100),
    dob varchar(10),
    gender varchar(1),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.santri(
    nis,
	nik_wali,
    full_name,
    dob,
    gender,
    created_at,
    created_by) 
values(
    nis,
	nik_wali,
    full_name,
    unix_timestamp(dob),
    gender,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_wali
DELIMITER $$
CREATE PROCEDURE inti.add_wali(
    id varchar(50),
	nik varchar(16),
    email varchar(100),
    no_hp varchar(20),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.wali(
    id,
	nik,
    email,
    no_hp,
    created_at,
    created_by) 
values(
    id,
	nik,
    email,
    no_hp,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_admin
DELIMITER $$
CREATE PROCEDURE inti.add_admin(
    id varchar(50),
	nik varchar(16),
    email varchar(100),
    no_hp varchar(20),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.admin(
    id,
	nik,
    email,
    no_hp,
    created_at,
    created_by) 
values(
    id,
	nik,
    email,
    no_hp,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_mudarrisin
DELIMITER $$
CREATE PROCEDURE inti.add_mudarrisin(
    id varchar(50),
	nik varchar(16),
    email varchar(100),
    no_hp varchar(20),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.mudarrisin(
    id,
	nik,
    email,
    no_hp,
    created_at,
    created_by) 
values(
    id,
	nik,
    email,
    no_hp,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_class
DELIMITER $$
CREATE PROCEDURE inti.add_class(
    id varchar(5),
    name varchar(30),
    gender varchar(1),
    year_of_study INT(4),
	level INT(2),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.class(
    id,
    name,
    gender,
    year_of_study,
	level,
    created_at,
    created_by) 
values(
    id,
    name,
    gender,
	year_of_study,
    level,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_course
DELIMITER $$
CREATE PROCEDURE inti.add_course(
    id varchar(5),
    name varchar(30),
    gender varchar(1),
    year_of_study INT(4),
	level INT(2),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.course(
    id,
    name,
    year_of_study,
	level,
    created_at,
    created_by) 
values(
    id,
    name,
	year_of_study,
    level,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_class_santri
DELIMITER $$
CREATE PROCEDURE inti.add_class_santri(
    id varchar(8),
	class_id varchar(5),
    santri_nis varchar(5),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.class_santri(
    id,
    class_id,
    santri_nis,
    created_at,
    created_by) 
values(
    id,
    class_id,
    santri_nis,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;

-- func add_class_mudarrisin
DELIMITER $$
CREATE PROCEDURE inti.add_class_mudarrisin(
    id varchar(8),
	class_id varchar(5),
    mudarrisin_id varchar(50),
	is_wali_kelas BOOL,
	course_id varchar(5),
    created_by varchar(50)
    )
BEGIN
insert ignore into inti.class_mudarrisin(
    id,
    class_id,
    mudarrisin_id,
	is_wali_kelas,
	course_id,
    created_at,
    created_by) 
values(
    id,
    class_id,
    mudarrisin_id,
	is_wali_kelas,
	course_id,
    unix_timestamp(now()),
    created_by);
END$$
DELIMITER ;