FROM node:20.6.1

ADD . /node_app

WORKDIR /node_app

#enable the code below if u dont have ssl certificates once u have them place them inside the certs folder
# mkdir certs

# enable this if u have not configured .env file and also ensure all URIs and keys are correct
#RUN mv .env.template .env

RUN npm install

EXPOSE 3000

CMD ["npx","nodemon","index.js"]