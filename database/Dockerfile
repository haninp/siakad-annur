FROM mysql:8.0.33
ENV MYSQL_ROOT_PASSWORD=root
# COPY ./mysql-conf/conf.d /etc/mysql/conf.d
COPY ./initial.sql /docker-entrypoint-initdb.d

# docker build -t siakaddb:0.19 .