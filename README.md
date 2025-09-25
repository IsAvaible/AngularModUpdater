# Minecraft Mod Updater

A Minecraft Java mod updater and migrator using the Modrinth & Curseforge API build with [Angular](https://angular.io/).
Visit the latest deployment [here](https://mc-mod-updater.vercel.app/).

## Features

Allows you to update or migrate your mods, modpacks, resource packs and shaders via simple drag and drop or file upload (.jar / .mrpack / .json / .zip).
You may select the version and loader you want to search updates for or migrate to.
Returns a list of all available version files of your mods and lets you download them.

## Screenshot

![Screenshot of the website](doc/Screenshot.jpeg)

## Usage

There are two ways to use this application:

### 1\. Hosted Version

The easiest way to get started is to use the public version hosted at **[mc-mod-updater.vercel.app](https://mc-mod-updater.vercel.app/)**.

This version is automatically built and deployed by Vercel directly from the `main` branch of this repository. You can view the [deployment history here](https://github.com/IsAvaible/AngularModUpdater/deployments/Production).

---

### 2\. Self-Hosting with Docker

You can also run the application on your own machine using Docker.

**Prerequisites:**

- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/products/docker-desktop/)

**Instructions:**

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/IsAvaible/AngularModUpdater.git
    cd AngularModUpdater
    ```

2.  **Build & run the Docker container:**
    ```bash
    docker rm minecraft-mod-updater
    docker build -t minecraft-mod-updater .
    docker run --name minecraft-mod-updater -p 8080:8080 --restart unless-stopped minecraft-mod-updater
    ```
    The application will be accessible at `http://localhost:8080`. The container will be called `minecraft-mod-updater` and will restart automatically unless stopped.

## Contributors

- [@orangishcat](https://github.com/orangishcat) - Add predefined URLs to update mods from GitHub [#13](https://github.com/IsAvaible/AngularModUpdater/pull/13)
- [@swishkin](https://github.com/swishkin) - Containerize application with Docker [#14](https://github.com/IsAvaible/AngularModUpdater/pull/14)

Want to contribute? Check out the [CONTRIBUTING.md](CONTRIBUTING.md) guide.
