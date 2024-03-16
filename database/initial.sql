-- create database;
create database inti;
create database pendaftaran;

-- USER initial user untuk database
CREATE USER `sysadm`@`%` IDENTIFIED WITH mysql_native_password BY 'siakad';
GRANT ALL PRIVILEGES ON *.* TO `sysadm`@`%` WITH GRANT OPTION;
GRANT SUPER ON *.* TO 'sysadm'@'%';

FLUSH PRIVILEGES;

-- inti.personal definition
CREATE TABLE `inti`.`personal` (
  `nik` varchar(16) NOT NULL,
  `nama` varchar(100) NOT NULL,
  `gender` varchar(1) NOT NULL,
  `tanggal_lahir` BIGINT NOT NULL,
  `tempat_lahir` varchar(100) NOT NULL,
  `alamat_ktp` text NULL,
  `alamat_domisili` text NULL,
  `pekerjaan` varchar(100) DEFAULT NULL,
  `created_at` BIGINT NOT NULL,
  `created_by` varchar(16) NOT NULL,
  `updated_at` BIGINT NULL,
  `updated_by` varchar(16) DEFAULT NULL,
  `deleted_at` BIGINT NULL,
  `deleted_by` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`nik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- inti.pengajar definition
CREATE TABLE `inti`.`pengajar` (
  `nip` BIGINT NOT NULL DEFAULT (uuid_short()),
  `nik` varchar(16) NOT NULL,
  `level_id` int NOT NULL,
  `mulai_mengajar` BIGINT NOT NULL,
  `status_mengajar` tinyint(1) NOT NULL,
  `created_at` BIGINT NOT NULL,
  `created_by` varchar(16) NOT NULL,
  `updated_at` BIGINT NULL,
  `updated_by` varchar(16) DEFAULT NULL,
  `deleted_at` BIGINT NULL,
  `deleted_by` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`nip`),
  KEY `pengajar_FK` (`nik`),
  CONSTRAINT `pengajar_FK` FOREIGN KEY (`nik`) REFERENCES `personal` (`nik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- inti.siswa definition
CREATE TABLE `inti`.`siswa` (
  `nis` BIGINT NOT NULL DEFAULT (uuid_short()),
  `nik` varchar(16) DEFAULT NULL,
  `nama` varchar(100) NOT NULL,
  `gender` varchar(1) NOT NULL,
  `tanggal_lahir` BIGINT NOT NULL,
  `tempat_lahir` varchar(100) NOT NULL,
  `nik_wali` varchar(16) NOT NULL,
  `created_at` BIGINT NOT NULL,
  `created_by` varchar(16) NOT NULL,
  `updated_at` BIGINT NULL,
  `updated_by` varchar(16) DEFAULT NULL,
  `deleted_at` BIGINT NULL,
  `deleted_by` varchar(16) DEFAULT NULL,
  UNIQUE KEY `siswa_UN` (`nis`),
  KEY `siswa_FK` (`nik_wali`),
  KEY `siswa_FK2_idx` (`nik`),
  CONSTRAINT `siswa_FK` FOREIGN KEY (`nik_wali`) REFERENCES `personal` (`nik`),
  CONSTRAINT `siswa_FK2` FOREIGN KEY (`nik`) REFERENCES `personal` (`nik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- STORED PROCEDURE
DELIMITER //

CREATE PROCEDURE `inti`.`tambah_personal`(
    nik varchar(16),
    nma varchar(100),
    gdr varchar(1),
    tgl_lhr BIGINT,
    tmp_lhr varchar(100),
    alm_ktp TEXT,
    alm_dom TEXT,
    pkj varchar(100),
    cre_by varchar(16)
    )
BEGIN
insert ignore into inti.personal(
    nik,
    nama,
    gender,
    tanggal_lahir,
    tempat_lahir,
    alamat_ktp,
    alamat_domisili,
    pekerjaan,
    created_at,
    created_by) 
values(
    nik,
    nma,
    gdr,
    unix_timestamp(tgl_lhr),
    tmp_lhr,
    alm_ktp,
    alm_dom,
    pkj,
    unix_timestamp(current_time()),
    cre_by);
END//

CREATE PROCEDURE `inti`.`hapus_personal`(
    nik varchar(16),
    del_by varchar(16)
    )
BEGIN
	UPDATE inti.personal SET 
    updated_at = unix_timestamp(current_time()), 
    updated_by = del_by, 
    deleted_at = unix_timestamp(current_time()), 
    deleted_by = del_by 
    WHERE (nik = nik);
END//

CREATE PROCEDURE `inti`.`ubah_personal` (
    nik varchar(16),
    nma varchar(100),
    gdr varchar(1),
    tgl_lhr BIGINT,
    tmp_lhr varchar(100),
    alm_ktp TEXT,
    alm_dom TEXT,
    pkj varchar(100),
    upd_by varchar(16)
    )
BEGIN
	UPDATE inti.personal SET 
    nama = nma, 
    gender = gdr,
    tanggal_lahir = unix_timestamp(tgl_lhr), 
    tempat_lahir = tmp_lhr, 
    alamat_ktp = alm_ktp, 
    alamat_domisili = alm_dom, 
    pekerjaan = pkj, 
    updated_at = utc_timestamp(), 
    updated_by = upd_by 
    WHERE (nik = nik);
END//

CREATE PROCEDURE `inti`.`tambah_pengajar`(
    noik varchar(16),
    lvl_id INT,
    sta_ajr INT,
    stt_ajr BIGINT,
    cre_by varchar(16)
    )
BEGIN
declare stat int;
set stat = (select status_mengajar from inti.pengajar where nik=noik order by mulai_mengajar desc limit 1);

if stat is NOT NULL then
    if stat=1 then
		select("status pengajar masih aktif");
	else if stat=0 then
		-- select("berhasil tambah karena status sudah tidak aktif ="+stat);
        insert ignore into inti.pengajar(
		  nik,
		  level_id,
		  mulai_mengajar,
		  status_mengajar,
		  created_at,
		  created_by) 
		values(
		  noik,
		  lvl_id,
		  unix_timestamp(sta_ajr),
		  stt_ajr,
		  unix_timestamp(current_time()),
		  cre_by);
	end if;
    end if;
else
    -- select("berhasil tambah ="+stat);
    insert ignore into inti.pengajar(
	  nik,
	  level_id,
	  mulai_mengajar,
	  status_mengajar,
	  created_at,
	  created_by) 
	values(
	  noik,
	  lvl_id,
	  unix_timestamp(sta_ajr),
	  stt_ajr,
	  unix_timestamp(current_time()),
	  cre_by);
	
end if;
END//

DELIMITER ;