                   # Super Shelf Inventory Cloud App

Welcome to the Super Shelf Inventory Cloud App, which integrates an advanced shelf
inventory process into the ExLibris Alma Library Management System. Super Shelf
Inventory is designed from the ground up with flexibility in mind, contributing to its use
by over 130 libraries around the world.

This app takes a list of barcodes scanned from your shelves and reports on a number
of potential issues. This includes marking out-of-order items, items in the wrong locations,
items with wrong policy / material types, and more. The report can be configured
to narrow down the issues it's reporting on to assist you with specific tasks. This
cloud app is also able to automatically mark items as inventoried and automatically
scan in items that are not in place.

For a user guide, please see [the USMAI Super Shelf Inventory User Guide](https://usmai.org/portal/x/54B2F) - this
readme is designed for administrators and developers.

## Authorship

Created by Erik Jones

## Local Development

If you've not done so, install the ExLibris Cloud App CLI with the following command:

```npm install -g @exlibris/exl-cloudapp-cli```

Then, clone the git repository onto your local machine. From the root directory
of the repository, initialize the application using the instructions in the
[ExLibris Init Command Documentation](https://developers.exlibrisgroup.com/cloudapps/docs/cli/#init).

## Usage

You can the run the application using the command: `eca start`

You can run the automated test suite with: `eca test`

## Contributing

### Etiquette

We would love any contributions to the app! Simply put a GitHub Pull Request with
the code that you'd like to add. **Before you make the request, ensure you run `eca build`
and `eca test` to ensure everything works properly.**

If you're modifying data processing / parsing processes, ensure that the test suite
is kept up to date. Also, if you're adding new data parsing processes, we would
request that you add a few unit tests of your own. You don't have to do UI testing
unless you wish to.

###  Understanding Application Structure

This Cloud App has quite a few components and services. I am creating a docs folder
which can help you understand how the application works internally. This will be helpful
for situations where you want to add or fix code, but don't know where you should
modify.

You'll see, for example, that the call number parsing and sorting takes place in
`call-number.service.ts`.

## License

This application is licensed under the Apache 2.0 license. Please see [our License](LICENSE)
for more information. 