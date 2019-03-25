$(document).ready(() => {
  
  let headers = $(".header").map((ind, item) => {
    return $(item).text();
  });
  
  let arrows = $(".fa-arrow-down");
    
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
  
});

const removeFunction = () => {
  
}