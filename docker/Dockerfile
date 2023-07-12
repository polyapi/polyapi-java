FROM node:18
RUN apt-get update && apt-get install -y \
    python3-pip sqlite3

ENV DOCKER_VERSION=20.10.9
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-$DOCKER_VERSION.tgz | tar xz -C /tmp && \
    mv /tmp/docker/docker /usr/local/bin && \
    rm -rf /tmp/docker

# Install Knative CLI (needed for server side functions)
RUN mkdir -p /poly/funcs/bin && \
    mkdir -p /poly/funcs/serverfx && \
    curl -Lo /poly/funcs/bin/kn https://storage.googleapis.com/knative-nightly/client/latest/kn-linux-amd64 && \
    curl -Lo /poly/funcs/bin/kn-func https://github.com/knative/func/releases/latest/download/func_linux_amd64 && \
    chmod -R +x /poly/funcs
COPY . /poly/app
WORKDIR /poly/app
ENV PRISMA_HOME_DIR=/poly/app/prisma
RUN rm .env*
RUN yarn install
RUN yarn run prisma generate
WORKDIR /poly/app/science
RUN pip install -r ./requirements.txt --break-system-packages
RUN prisma generate
WORKDIR /poly/app
# Could not find a way to run prisma generate as non-root, so took a different approach which is a bit of hack and needs relooking at later on
# Basically installed the app as root under /poly then changed ownership and voila, it works
# Also note that had to define DATABASE_URL to ensure binaries were not placed under /root/.cache/prisma-python/binaries
RUN groupadd -r poly && \
    useradd -r -g poly -d /poly poly && \
    chown -R poly:poly /poly
USER poly
ENV PATH="/poly/funcs/bin:${PATH}"
ENTRYPOINT [ "sh","./docker/scripts/entrypoint.sh" ]
EXPOSE 8000 5000 80