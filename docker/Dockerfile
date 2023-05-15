FROM node:18
RUN mkdir poly-alpha
COPY . poly-alpha
WORKDIR /poly-alpha
RUN rm .env*
RUN apt-get update && apt-get install -y \
    python3-pip 
RUN yarn install
RUN yarn prisma migrate deploy
EXPOSE 8000
WORKDIR /poly-alpha/science
RUN pip install -r ./requirements.txt
RUN prisma generate
ENTRYPOINT [ "sh","../docker/entrypoint.sh" ]
EXPOSE 5000