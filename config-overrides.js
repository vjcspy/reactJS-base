const WebpackBeforeBuildPlugin = require('before-build-webpack');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');

// for more detail https://stackoverflow.com/questions/54770313/react-w-service-worker-push-notifications/55062427#55062427
// from https://www.viget.com/articles/run-multiple-webpack-configs-sequentially/
class WaitPlugin extends WebpackBeforeBuildPlugin {
    constructor(file, interval = 100, timeout = 60e3) {
        super(function (stats, callback) {
            const start = Date.now();

            function poll() {
                if (fs.existsSync(file)) {
                    callback()
                } else if (Date.now() - start > timeout) {
                    throw Error(`Couldn't access ${file} within ${timeout}s`)
                } else {
                    setTimeout(poll, interval)
                }
            }

            poll()
        })
    }
}

const swOutputName = 'sw.js';
const workerSource = path.resolve(__dirname, 'src', 'sw.js');

module.exports = {
    // The Webpack config to use when compiling your react app for development or production.
    webpack: (config, env) => {
        if (env !== 'production') {
            return config;
        }
        // we need 2 webpack configurations:
        // 1- for the service worker file.
        //    it needs to be processed by webpack (to include 3rd party modules), and the output must be a
        //    plain, single file, not injected in the HTML page
        const swConfig = _.merge({}, config, {
            name: 'service worker',
            entry: workerSource,
            output: {
                filename: swOutputName
            },
            optimization: {
                splitChunks: false,
                runtimeChunk: false
            }
        });
        delete swConfig.plugins;

        // 2- for the main application.
        //    we'll reuse configuration from create-react-app, without a specific Workbox configuration,
        //    so it could inject workbox-precache module and the computed manifest into the BUILT service-worker.js file.
        //    this require to WAIT for the first configuration to be finished
        if (env === 'production') {
            const builtWorkerPath = path.resolve(config.output.path, swOutputName);
            config.name = 'main-application';
            config.plugins.push(
                new WorkboxWebpackPlugin.InjectManifest({
                    swSrc: builtWorkerPath,
                    swDest: swOutputName
                }),
                new WaitPlugin(builtWorkerPath)
            );
        }

        // remove Workbox service-worker.js generator
        const removed = config.plugins.findIndex(
            ({constructor: {name}}) => name === 'GenerateSW'
        );
        if (removed !== -1) {
            config.plugins.splice(removed, 1)
        }

        const result = [swConfig, config];
        // compatibility hack for CRA's build script to support multiple configurations
        // https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/scripts/build.js#L119
        result.output = {publicPath: config.output.publicPath};
        return result
    },
    // The Jest config to use when running your jest tests - note that the normal rewires do not
    // work here.
    jest: function (config) {
        // ...add your jest config customisation...
        // Example: enable/disable some tests based on environment variables in the .env file.
        if (!config.testPathIgnorePatterns) {
            config.testPathIgnorePatterns = [];
        }
        if (!process.env.RUN_COMPONENT_TESTS) {
            config.testPathIgnorePatterns.push('<rootDir>/src/components/**/*.test.js');
        }
        if (!process.env.RUN_REDUCER_TESTS) {
            config.testPathIgnorePatterns.push('<rootDir>/src/reducers/**/*.test.js');
        }
        return config;
    },
    // The function to use to create a webpack dev server configuration when running the development
    // server with 'npm run start' or 'yarn start'.
    // Example: set the dev server to use a specific certificate in https.
    devServer: function (configFunction) {
        // Return the replacement function for create-react-app to use to generate the Webpack
        // Development Server config. "configFunction" is the function that would normally have
        // been used to generate the Webpack Development server config - you can use it to create
        // a starting configuration to then modify instead of having to create a config from scratch.
        return function (proxy, allowedHost) {
            // Create the default config by calling configFunction with the proxy/allowedHost parameters
            const config = configFunction(proxy, allowedHost);

            // Change the https certificate options to match your certificate, using the .env file to
            // set the file paths & passphrase.
            // const fs = require('fs');
            // config.https = {
            //     key: fs.readFileSync(process.env.REACT_HTTPS_KEY, 'utf8'),
            //     cert: fs.readFileSync(process.env.REACT_HTTPS_CERT, 'utf8'),
            //     ca: fs.readFileSync(process.env.REACT_HTTPS_CA, 'utf8'),
            //     passphrase: process.env.REACT_HTTPS_PASS
            // };

            // Return your customised Webpack Development Server config.
            return config;
        };
    },
    // The paths config to use when compiling your react app for development or production.
    paths: function (paths, env) {
        // ...add your paths config
        return paths;
    },
};
