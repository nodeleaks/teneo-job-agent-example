// // execution
// console.log(1);

// // 5th phase (naming check) (MACRO queue)
// setImmediate(() => {
//   console.log(2)
// })

// // 1st phase(naming timers) (MACRO queue)
// setTimeout(function() { console.log(3) }, 0);

// // execution
// const promise = new Promise((resolve) => {
//   console.log(4)
  
//   resolve()
// })

// // MICRO queue
// promise.then(() => {
//   console.log(5)
  
//   process.nextTick(() => console.log(6))
  
//   const promise2 = new Promise((resolve) => {
//     resolve()
//   })
  
//   promise2.then(() => console.log(7))
// })

// // MICRO queue
// promise.then(() => console.log(8))

// // nextTick higher priority over promise.then (MICRO queue)
// process.nextTick(() => console.log(9))

// // execution
// console.log(10)


Promise.resolve().then(() => {
  process.nextTick(() => console.log('nextTick — 6'))
  
  Promise.resolve().then(() => console.log('promise.then — 7'))
})
