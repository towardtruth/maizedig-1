/**
 * TagBoad: Drawing object for the Tag Board
 * @params tagBoard, originalData, image, imageMetadata, genomeInfo, siteUrl
 * @return none
 *
 * Updated by Kyoung Tak Cho
 * Updated date: Tue Jun 10 15:31:27 CDT 2019
 */
/*
 -------------------------------------------------------------------------------------
 					Drawing object for the Tag Board (uses KineticJS)
 					
 					Dependencies:
 						1. jQuery 1.7.2
 						2. Utilities.js in the taggableUtil package
 						3. KineticJs v3.10.0
 						4. Tag.js in the taggableUtil package
 -------------------------------------------------------------------------------------
*/
function TagBoard(tagBoard, originalData, image, imageMetadata, genomeInfo, siteUrl) {
	this.board = tagBoard;
	this.image = image;
	this.imageCache = new Image();
	this.imageCache.src = this.image[0].src;
	this.imageMetadata = imageMetadata;
	this.tagGroups = this.__convertOriginalDataToTagGroups(originalData);
	this.stage = null;
	this.layer = null;
	this.locked = false;
	this.tagsVisible = true;
	this.currentTagGroups = {};
	var self = this;
	$.each(this.tagGroups, function(key, group) {
		self.currentTagGroups[key] = group;
	});
	this.siteUrl = siteUrl;
	this.tagInfo = genomeInfo.find('.geneLinksInfo .tagInfoContainer');
	this.geneLinksInfo = genomeInfo.find('.geneLinksInfo');
	this.visibleShapes = [];
};

TagBoard.prototype.getImageUrl = function() {
	return this.image[0].src;
};

TagBoard.prototype.getImageCache = function() {
	return this.imageCache;
};

TagBoard.prototype.getOrganisms = function() {
	return this.imageMetadata.organisms;
};

TagBoard.prototype.getUploadedBy = function() {
	return this.imageMetadata.uploadedBy;
};

TagBoard.prototype.getUploadDate = function() {
	return this.imageMetadata.uploadDate;
};

TagBoard.prototype.getBoard = function() {
	return this.board;
};

TagBoard.prototype.getTagGroups = function() {
	return this.tagGroups;
};

TagBoard.prototype.getSelectedTags = function() {
	var tags = {};
	for (var i = 0; i < this.visibleShapes.length; i++) {
		var tag = this.visibleShapes[i].tag;
		tags[tag.getId()] = tag;
	}
	return tags;
};

TagBoard.prototype.addTag = function(color, points, description, tagGroupKey, callback, errorCallback) {
	var group = this.tagGroups[tagGroupKey];
	var tag = new Tag(null, null, color, points, description, [], this.imageMetadata.id, this.siteUrl, group);
	
	// saves the tag and then adds the 
	tag.save(
		Util.scopeCallback(this, function(newTag) {
			tag.setId(newTag['id']);
			group.addTag(tag);
			
			this.redraw();
			
			callback();
		}),
		function(errorMessage) {
			errorCallback(errorMessage);
		}
	);
};

TagBoard.prototype.redraw = function() {
	this.locked =  false;
	var id = this.imageMetadata.id;
	
	// check to see if a stage has been initialized
	if (!this.stage) {
		// create a new one
		this.stage = new Kinetic.Stage({
			container: this.board[0],
			width: this.board.width(),
			height: this.board.height()
		});
	}
	else {
		// clear the original stage and resize it
		this.stage.setSize(this.board.width(), this.board.height());
		this.stage.removeChildren();
	}
	
	this.layer = new Kinetic.Layer();
	var self = this;
	$.each(this.currentTagGroups, function(key, group) {
	    var tags = group.getTags();
	    // Draws the tags on the board and sets up mouseover and mouseout events
	    $.each(tags, function(id, tag) {
		    self.layer.add(self.__createPolyFromTag(tag, id));
	    });
	  
	    self.stage.add(self.layer);
	});
	
	this.board.on('mousemove', Util.scopeCallback(this, this.boardMouseMove));
};

TagBoard.prototype.toggleTags = function() {
	this.tagsVisible = !this.tagsVisible;
	this.redraw();
};

TagBoard.prototype.__createPolyFromTag = function(tag, i) {
	// gets the color unless it is black, because that is code for transparent drawing
	var color = tag.getFormattedColor();
	
	// converts the tag's points to the current zoom level
	var drawPoints = [];
	for (var j = 0; j < tag.getPoints().length; j++) {
		drawPoints[j] = TaggableUtil.convertFromOriginalToZoom(tag.getPoints()[j], this.image);
	}
	
	// checks if the points represent a rectangle and fixes the array to be a four point
	// array in the correct order for drawing
	if (drawPoints.length == 2) {
		var otherPoints = TaggableUtil.getOtherRectPoints(drawPoints);
		drawPoints[2] = drawPoints[1];
		drawPoints[1] = otherPoints[0];
		drawPoints[3] = otherPoints[1];
	}
	
	var fill = "";
	if (this.tagsVisible) {
		fill = color;
	}
	
	// creates a polygon with the points for this tag
	var poly = new Kinetic.Polygon({
		points: $.map( drawPoints, function(point){return [point.x, point.y]}),
		fill: fill,
		stroke: "rgba(255,255,255,0)",
		strokeWidth: 1
	});
	
	// sets the color and description for this polygon
	poly.tag = tag;
	poly.setId(i);
	
	// finds the position of the tooltip for this polygon
	// should be centered in the middle of the polygon and below it
	var leftMin = 10000000;
	var leftMax = -1;
	var topMax = -1;
	for (var j = 0; j < drawPoints.length; j++) {
		if (drawPoints[j][0] < leftMin) {
			leftMin = drawPoints[j][0];
		}
		
		if (drawPoints[j][0] > leftMax) {
			leftMax = drawPoints[j][0];
		}
		
		if (drawPoints[j][1] > topMax) {
			topMax = drawPoints[j][1];
		}
	}
	
	poly.pos = [(leftMin + leftMax)/2, topMax];
	
	// toggles the mouseout event for this poly
	// and the mouseover events for all other poly's
	poly.on('click', Util.scopeCallback(this, this.polyOnClick));
	
	return poly;
};

TagBoard.prototype.polyOnClick = function(event) {
	this.locked = !this.locked;
};

TagBoard.prototype.boardMouseMove = function(event) {
	if (!this.locked) {		
		var mousePos = this.stage.getMousePosition(event);
		
		if (this.visibleShapes.length > 0) {
			for (var i = 0; i < this.visibleShapes.length; i++) {
				// draws the shape on mouse over
				this.visibleShapes[i].attrs.fill = this.tagsVisible ? this.visibleShapes[i].tag.getFormattedColor() : "";
				this.visibleShapes[i].attrs.stroke = "rgba(255,255,255,0)";
			}
			this.tagsVisible.length = 0;
		}
		
		this.visibleShapes = this.stage.getIntersections(mousePos);
		this.tagInfo.find('.tag-info').removeClass('tag-info').addClass('tag-info-old');
		
		if (this.visibleShapes.length > 0) {
			this.geneLinksInfo.find('.geneLinksInfoTitle').show();
		}
		else {
			this.geneLinksInfo.find('.geneLinksInfoTitle').hide();
		}
		
		for (var i = 0; i < this.visibleShapes.length; i++) {
			// draws the shape on mouse over
			this.visibleShapes[i].attrs.fill = this.visibleShapes[i].tag.getFormattedColor();
			this.visibleShapes[i].attrs.stroke = "black";
			var tag = this.visibleShapes[i].tag;
			var info = this.tagInfo.find('#' + tag.getId() + '-info');
			if (info.length == 0) {
				var newTagInfo = $('<div />', {
					'class' : 'tag-info',
					'id' : tag.getId() + '-info'
				});
					
				var newTagInfoTable = $('<table cellspacing="0" />', {
					
				});
				
				var descriptionRow = $('<tr />');
				var descriptionLabel = $('<td />', {
					'text' : 'Tag Name:',
					'class' : 'geneLinkLabel'
				});
				var description = $('<td />', {
					'text' : tag.getDescription() + '(Created by: ' + tag.getUserName() + ')'
				});
				
				descriptionRow.append(descriptionLabel);
				descriptionRow.append(description);
				newTagInfoTable.append(descriptionRow);
				
				var colorRow = $('<tr />', {
					'class' : 'even'
				});
				var colorLabel = $('<td />', {
					'text' : 'Color:',
					'class' : 'geneLinkLabel'
				});
				var color = $('<td />', {
					'text' : ''
				});
				
				var colorBox = $('<span />', {
					'class' : 'color-box',
					'style' : 'background-color: ' + tag.getFormattedColor()
				});
				
				color.append(colorBox);
				
				colorRow.append(colorLabel);
				colorRow.append(color);
				newTagInfoTable.append(colorRow);
				
				if (tag.getGeneLinks().length > 0) {
					var geneLinks = tag.getGeneLinks();
					for (var i = 0; i < geneLinks.length; i++) {
						var geneLink = geneLinks[i];
						var geneLinkRow = $('<tr />');
						var geneLinkLabel = $('<td />', {
							'text' : i == 0 ? 'Gene Links:' : '',
							'class' : 'geneLinkLabel'
						});
						var geneLinkCell = $('<td />');

						var geneLinkName = $('<font />', {
							'text' : geneLink.getName(),
							'style' : 'margin-right: 5px; font-size: 12px'
						});

						var geneLinkAllele = $('<a />', {
							'text' : '(' + geneLink.getAllele() + ')',
                            //'style' : 'margin-left: 20px; margin-right: 20px; font-size: 12px',
                            'style' : 'font-size: 12px',
                            'target' : '_blank',
                            'href' : 'https://www.maizegdb.org/data_center/variation/' + geneLink.getAllele()
						});

						var geneLinkGBrowser = $('<a />', {
							'text' : 'GBrowser',
							'style' : 'margin-left: 20px; margin-right: 20px; font-size: 12px',
                            'target' : '_blank',
                            'href' : 'https://www.maizegdb.org/gbrowse/maize_v4test?l=MaizeDIG;q=' + this.imageMetadata.geneSymbol
						});

                        var geneLinkGeneModelPage = $('<a />', {
                            'text' : 'Gene Model',
							'style' : 'font-size: 12px',
                            'target' : '_blank',
                            'href' : 'https://www.maizegdb.org/gene_center/gene/' + this.imageMetadata.geneSymbol
                        });

                        var geneLinkBR = $('<br>', {
                            'text' : ''
                        });
						
						geneLinkCell.append(geneLinkName);
						if (geneLink.getAllele())
							geneLinkCell.append(geneLinkAllele);
                        geneLinkCell.append(geneLinkBR);
                        geneLinkCell.append(geneLinkGBrowser);
                        geneLinkCell.append(geneLinkGeneModelPage);
						geneLinkRow.append(geneLinkLabel);
						geneLinkRow.append(geneLinkCell);
						newTagInfoTable.append(geneLinkRow);
						newTagInfo.append(newTagInfoTable);
					}
				}
				else {
					var geneLinkRow = $('<div />', {
						'text' : 'There are no gene links for this tag.'
					});
					
					newTagInfo.append(newTagInfoTable);
					newTagInfo.append(geneLinkRow);
				}
				
				this.tagInfo.append(newTagInfo);
			}
			else if (info.length > 1) {
				info = info.slice(0, 1);
				info.removeClass('tag-info-old').addClass('tag-info');
			}
			else {
				info.removeClass('tag-info-old').addClass('tag-info');
			}
		}
		
		this.tagInfo.find('.tag-info-old').remove();
 
		this.layer.draw();
	}
};

TagBoard.prototype.__getPolyPos = function(poly) {
	var pos = TaggableUtil.findPosition(this.board[0]);
	return [pos[0] + poly.pos[0], pos[1] + poly.pos[1]];
};

TagBoard.prototype.__convertOriginalDataToTagGroups = function(originalData) {
	//var tagGroups = {};
	var tagGroups = [];

	//for (group in originalData) {
	for (var group = 0; group < originalData.length; group++) {
		var newGroup = new TagGroup(originalData[group], this.imageMetadata.id, this.siteUrl);
		var self = this;
		//tagGroups[newGroup.getId()] = newGroup;
		tagGroups.push(newGroup);
	}

	return tagGroups;
};

TagBoard.prototype.addToCurrentTagGroups = function(tagGroup, redraw) {
	this.currentTagGroups[tagGroup.key] = tagGroup;
	if (redraw) {
		this.redraw();
	}
};

TagBoard.prototype.removeFromCurrentTagGroups = function(tagGroup, redraw) {
	delete this.currentTagGroups[tagGroup.key];
	if (redraw) {
		this.redraw();
	}
};

TagBoard.prototype.emptyCurrentTagGroups = function() {
	for (var key in this.currentTagGroups) {
		if (this.currentTagGroups.hasOwnProperty(key)) {
			delete this.currentTagGroups[key];
		}
	}
};

TagBoard.prototype.addNewTagGroup = function(name, callback, errorCallback) {
	var self = this;
	$.ajax({
		url: this.siteUrl + 'api/tagGroups',
		type: 'POST',
		dataType: 'json',
		data: {
			imageId: self.imageMetadata.id,
			name: name
		},
		success: function(data, textStatus, jqXHR) {			
			// add a new tag group
			var newTagGroup = new TagGroup(data, self.imageMetadata.id, self.siteUrl);
			self.tagGroups[newTagGroup.getId()] = newTagGroup;
			self.addToCurrentTagGroups(newTagGroup);
			if (callback) {
				callback();
			}
		},
		error: function(jqXHR, textStatus, errorThrown) {
			var errorMessage = $.parseJSON(jqXHR.responseText).message;
			errorCallback(errorMessage);
		}
	});
};

TagBoard.prototype.getCurrentTagGroups = function() {
	return this.currentTagGroups;
};

TagBoard.prototype.createFile = function(urlOfImage, imageFile, organisms, uploadDateUser, 
		tagGroups, imageTags, geneLinks, xml, cached) {
	if (xml) {
		if (cached) {
			return new CachedXmlDataFile(this, urlOfImage, imageFile, organisms, uploadDateUser, tagGroups, imageTags, geneLinks);
		}
		else {
			return new FreshXmlDataFile(this, urlOfImage, imageFile, organisms, uploadDateUser, tagGroups, imageTags, geneLinks);
		}
	}
	else {
		if (cached) {
			return new CachedJsonDataFile(this, urlOfImage, imageFile, organisms, uploadDateUser, tagGroups, imageTags, geneLinks);
		}
		else {
			return new FreshJsonDataFile(this, urlOfImage, imageFile, organisms, uploadDateUser, tagGroups, imageTags, geneLinks);
		}
	}
};
