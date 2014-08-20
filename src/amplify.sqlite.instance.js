// ensure the instance runs as a singleton to minimize memory usage since 
// sqlite can only run on one thread in modern browsers
amplify.sqlite.instance = new amplify.sqlite();
