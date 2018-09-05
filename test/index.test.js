const Index = require('../src/index')

const helloWorld = Index.HelloWorld

test('string is the hello world string  ', () => {
  expect(helloWorld).toEqual('Hello, world! This is going to be a VCF parser!')
})
