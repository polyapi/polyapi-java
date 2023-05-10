FROM node:18
RUN mkdir poly-alpha
COPY . poly-alpha
WORKDIR /poly-alpha
RUN apt-get update && apt-get install -y \
    python3-pip 
RUN yarn install
RUN yarn prisma migrate deploy
EXPOSE 8000
WORKDIR /poly-alpha/science
#These envs will be populated by github actions.
ENV OPENAI_API_KEY ${{ secrets.OPENAI_API_KEY }}
ENV ADMIN_API_KEY ${{ secrets.ADMIN_API_KEY }}
RUN pip install -r ./requirements.txt
RUN prisma generate
ENTRYPOINT [ "sh","../entrypoint.sh" ]
EXPOSE 5000