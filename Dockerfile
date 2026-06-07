ARG NODE_VERSION=22
FROM node:${NODE_VERSION}

WORKDIR /app

COPY . .

RUN chmod +x setup.sh start.sh
RUN bash ./setup.sh

ENV PORT=8000

EXPOSE ${PORT}

CMD ["/bin/bash", "./start.sh"]