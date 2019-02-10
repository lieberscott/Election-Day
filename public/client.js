let undoCounter = 0;

// exout a section (needs to use document.on to account for sections which are added dynamically)
$(document).on("click", ".fa-times-circle", (e) => {

  // STEP 1: HIDE the element (so user can undo the "deletion"),
  let clickedId = e.target.id;
  let sectionToHide = $("#" + clickedId).parentsUntil(".container");
  console.log(sectionToHide);
  sectionToHide.hide();

  sectionToHide.after('<button class="undo" id="undo' + undoCounter + '" style="display: block;">Undo deletion</button>');
  undoCounter++;
  
  setTimeout(() => {
    
    console.log("one");
    $("#undo" + undoCounter).remove();
    console.log("two");
    sectionToHide.remove();
    console.log("three");
    
    $.ajax({
      url: "/delete",
      data: { clickedId },
      success: () => { console.log("success") },
      failure: () => { console.log("failure") }
    })
  }, 3000);
  
});

$(document).on("click", ".undo", (e) => {
  // STEP 2: ADD classes back and show section again in if undo is clicked
  let clickedId = e.target.id;
  
  let prev = $("#" + clickedId).parentsUntil(".container");  
  let prevchildren = prev.children();

  prev.show();
  prevchildren.show();
  
  let children = prevchildren.children();
  
  // add classes back in
  $(children[3]).addClass("legSection");
  $(children[4]).addClass("plainSection");
  $(children[5]).addClass("fiscTenSection");
  
  // I don't know why, but this needs to be called TWICE to remove the actual undo button ?????
  $("#" + clickedId).remove();
  $("#" + clickedId).remove();

});
