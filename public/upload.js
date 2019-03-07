$(document).ready(() => {
  
  let headers = $(".header").map((ind, item) => {
    return $(item).text();
  });
  
  // let headers = $(".header");
  
  console.log(headers);
  
  // let arrows = $(".fa-arrow-down").map((ind, item) => {
  //   return $(item).attr("id");
  // });
  
  let arrows = $(".fa-arrow-down");
  
  console.log(arrows);
  
  const len = arrows.length;
  let count = 0;
  
  for (let i = 0; i < len; i++) {
    // need both "upload" and "count" because there could be 1 column of data with header lastname
    // thus, upload would be true, but count would be short
    // or, you could have data with eight columns, seven of which match but not the eighth
    // thus, count would be 7, but upload would be false
    let upload = true;
    if ($(arrows[i]).attr("id") == headers[i]) {
      $(arrows[i]).css("color", "green");
      count++;
    }
    
    else {
      $(arrows[i]).css("color", "red");
      upload = false;
    }
    
    if (upload && count == 8) {
      $("#addbutton").prop("disabled", false);
    }
    
  }
  
  
  

//   $.ajax({
//     url: "/upload",
//     method: "POST",
//     data: { clickedId, pollwatcher },
//     success: () => { console.log("success") },
//     failure: () => { console.log("failure") }
//     });
  
//   let clickedId = e.target.id;
//   console.log(e.target);
//   let pollwatcher = e.target.getAttribute("data-pollwatcher");
//   let sectionToHide = $("#" + clickedId).parentsUntil(".container");
//   console.log(sectionToHide);
//   sectionToHide.hide();

//   sectionToHide.after('<button class="undo" id="undo' + undoCounter + '" style="display: block;">Undo deletion</button>');
//   undoCounter++;

//   console.log("first num: ", num);
//   console.log("first x : ", x);
//   x = setTimeout(() => {
    
//     // not sure why, but this has to be called twice to work
    
//     let a = $("#undo" + (undoCounter - 1));
//     console.log(a);
//     $("#undo" + (undoCounter - 1)).remove();
//     $("#undo" + (undoCounter - 1)).remove();

//     sectionToHide.remove();
    
//     $.ajax({
//       url: "/voted",
//       data: { clickedId, pollwatcher },
//       success: () => { console.log("success") },
//       failure: () => { console.log("failure") }
//     });
//   }, 5000);
  
// });

// $(document).on("click", ".undo", (e) => {
  
//   num = e.target.id.split("undo")[1];
  
//   clearTimeout(num);
  
//   // STEP 2: ADD classes back and show section again in if undo is clicked
//   let clickedId = e.target.id;
  
//   let prev = $("#" + clickedId).parentsUntil(".container");  
//   let prevchildren = prev.children();

//   prev.show();
//   prevchildren.show();

  
//   // I don't know why, but this needs to be called TWICE to remove the actual undo button ?????
//   $("#" + clickedId).remove();
//   $("#" + clickedId).remove();

});

const removeFunction = () => {
  
}