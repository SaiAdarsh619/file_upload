ARG NODE_VERSION=22
FROM node:${NODE_VERSION}

WORKDIR /app

COPY . .

RUN bash ./start.sh

ENV PORT=443

EXPOSE ${PORT}

CMD ["/bin/bash", "./start.sh"]
