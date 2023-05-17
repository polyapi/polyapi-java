FROM node:18
RUN apt-get update && apt-get install -y \
    python3-pip 
COPY . /poly/app
WORKDIR /poly/app
ENV PRISMA_HOME_DIR=/poly/app/prisma
RUN yarn install
WORKDIR /poly/app/science
RUN pip install -r ./requirements.txt
RUN prisma generate
WORKDIR /poly/app
# Could not find a way to run prisma generate as non-root, so took a different approach which is a bit of hack and needs relooking at later on
# Basically installed the app as root under /poly then changed ownership and voila, it works
# Also note that had to define DATABASE_URL to ensure binaries were not placed under /root/.cache/prisma-python/binaries 
RUN groupadd -r poly && \
    useradd -r -g poly -d /poly poly && \
    chown -R poly:poly /poly
USER poly
ENTRYPOINT [ "sh","./docker/scripts/entrypoint.sh" ]
EXPOSE 8000 5000