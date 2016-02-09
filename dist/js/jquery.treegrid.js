/*
 * TreeGrid plugin v0.1.4
 * Copyright 2016 Dmitry Khlystov
 * Licensed under the MIT license
 */

(function($) {

	// PUBLIC FUNCTIONS
	// ================

	var methods = {
		toggle: function() {
			return this.each(function() {
				$this = $(this);
				if (_isExpanded($this)) methods.collapse.call($this);
				else if (_isCollapsed($this)) methods.expand.call($this);
			});
		},
		expand: function() {
			var changed = false;

			//process elements
			this.each(function() {
				var $this = $(this);
				//collapsed?
				if (!_isCollapsed($this)) return;
				//loaded?
				if (!$this.data('loaded') && !_load($this)) return;
				//expand
				_expand($this);
				changed = true;
			});

			//remake drop map if dragging
			if (isDragging) _makeDropMap();

			return this;
		},
		collapse: function() {
			var changed = false;

			//process elements
			this.each(function() {
				var $this = $(this);
				//expanded?
				if (!_isExpanded($this)) return;
				//collapse
				_collapse($this);
				changed = true;
			});

			//remake drop map if dragging
			if (isDragging) _makeDropMap();

			return this;
		},
		add: function(items) { //tr[]
			//process elements
			this.each(function() {
				_add($(this), items)
			});

			//remake drop map if dragging
			if (isDragging) _makeDropMap();

			return this;
		},
		remove: function() {
			//process elements
			this.each(function() {
				var $this = $(this),
					$parent = _getParent($this);
				_getBranch($this).remove();
				_initNode($parent, $parent.data('depth'));
			});

			//remake drop map if dragging
			if (isDragging) _makeDropMap();

			return this;
		},
		move: function(target, position) {
			var $tr, id, $oldParent = _getParent(this);

			//node insert after
			if (position == 0) $tr = target.prev();
			else $tr = _getBranch(target).last();

			//parent id
			id = position === 1 ? _getId(target) : _getParentId(target);
			this.removeClass('treegrid-parent-' + _getParentId(this));
			if (id !== null) this.addClass('treegrid-parent-' + id);

			//moving
			$branch = _getBranch(this);
			if ($tr.length) $branch.insertAfter($tr);
			else $branch.prependTo(this.parent());

			//hide if collapsed
			if (_parentCollapsed(this)) $branch.hide();

			//reinit
			if ($oldParent.length) _initNode($oldParent, $oldParent.data('depth'));
			var $parent = _getParent(this);
			if ($parent.length) _initNode($parent, $parent.data('depth'));
			else _initNode(this);
		},
		getRoots: function() {
			var items = [];
			this.find('>tbody>tr').each(function() {
				if (_getParentId($(this)) === null) items.push(this);
			});
			return $(items);
		},
		getChildNodes: function() {
			var items = $();
			this.each(function() {
				items = items.add(_getChildNodes($(this)));
			});
			return items;
		},
		getBranch: function() {
			var items = $();
			this.each(function() {
				items = items.add(_getBranch($(this)));
			});
			return items;
		},
		getParent: function() {
			var items = $();
			this.each(function() {
				items = items.add(_getParent($(this)));
			});
			return items;
		},
		isCollapsed: function() {
			var result = false;
			this.each(function() {
				result = _isCollapsed($(this));
				if (result) return false;
			});
			return result;
		},
		isExpanded: function() {
			var result = false;
			this.each(function() {
				result = _isExpanded($(this));
				if (result) return false;
			});
			return result;
		}
	};

	// PRIVATE FUNCTIONS
	// =================

	function _initTree(options) {
		//settings
		var $this = $(this), settings = $.extend({}, $.fn.treegrid.defaults, options);

		//process elements
		return $this.each(function() {
			var $this = $(this);

			//settings
			$this.data('treegrid-settings', settings);

			//event handlers
			$this
				.on('click', '>tbody>tr>td:first-child>.treegrid-container>.treegrid-expander', _expanderClick)
				.on('mousedown', '>tbody>tr>td:first-child>.treegrid-container', _nodeMouseDown);

			//init nodes
			_initNode(methods.getRoots.call($this), 1);
		});
	};
	function _expand($this) {
		//event callback
		var settings = $this.closest('table').data('treegrid-settings');
		if (!settings.onExpand.call($this)) return;
		//node class
		$this.addClass('expanded');
		//expander class
		$this.find('>td:first>.treegrid-container>.treegrid-expander')
			.removeClass('treegrid-expander-collapsed')
			.addClass('treegrid-expander-expanded');
		//render items
		_getBranch($this).not($this).each(function() {
			var $this = $(this);
			if (_parentCollapsed($this)) $this.hide();
			else $this.show();
		});
	};
	function _collapse($this) {
		//event callback
		var settings = $this.closest('table').data('treegrid-settings');
		if (!settings.onCollapse.call($this)) return;
		//node class
		$this.removeClass('expanded');
		//expander class
		$this.find('>td:first>.treegrid-container>.treegrid-expander')
			.removeClass('treegrid-expander-expanded')
			.addClass('treegrid-expander-collapsed');
		//hide items
		_getBranch($this).not($this).hide();
	};
	function _add($this, items) {
		var $target = _getBranch($this).last().next(), childs = [], parentId = _getId($this);
		//cell count
		var $table = $this, cellCount;
		if ($table.prop('tagName') !== 'TABLE') $table = $table.closest('table');
		cellCount = $table.find('tr:first>th,tr:first>td').length;
		//adding
		$.each(items, function(i, item) {
			var $tr = $(item), cnt = $tr.find('>td').length;
			//parent id
			if (parentId !== null) $tr.addClass('treegrid-parent-' + parentId);
			//cell count
			if (cnt < cellCount) for (var i = $tr.find('>td').length; i < cellCount; i++) $tr.append('<td>');
			else if (cnt > cellCount) $tr.find('>td').eq(cellCount - 1).nextAll().remove();
			//add to dom
			if ($target.length) $tr.insertBefore($target);
			else $table.find('tbody').append($tr);
			//add to result
			childs.push($tr[0]);
		});
		//childs to jquery
		childs = $(childs);
		//init node with childs
		if (parentId === null) _initNode(childs);
		_initNode($this, $this.data('depth'));
		//callbask
		var settings = $this.closest('table').data('treegrid-settings');
		settings.onAdd.call($this, childs);
	};
	function _getParent($this) {
		return $this.parent().find('>.treegrid-' + _getParentId($this));
	};
	function _getChildNodes($this) {
		return $this.parent().find('>.treegrid-parent-' + _getId($this));
	};
	function _getBranch($this) {
		var items = $this;
		if ($this.prop('tagName') !== 'TR') return items.not($this);
		_getChildNodes($this).each(function() {
			items = items.add(_getBranch($(this)));
		});
		return items;
	};
	function _getId($this) {
		var template = /treegrid-([A-Fa-f0-9_]+)/;
		if (template.test($this.attr('class'))) {
			return template.exec($this.attr('class'))[1];
		};
		return null;
	};
	function _getParentId($this) {
		var template = /treegrid-parent-([A-Fa-f0-9_]+)/;
		if (template.test($this.attr('class'))) {
			return template.exec($this.attr('class'))[1];
		};
		return null;
	};
	function _isCollapsed($this) {
		return $this.data('count') && !$this.hasClass('expanded');
	};
	function _isExpanded($this) {
		return $this.data('count') && $this.hasClass('expanded');
	};
	function _initNode($this, depth, forceExpand) {
		if (depth === undefined) depth = 1;
		$this.each(function() {
			var $this = $(this).data('depth', depth);
			//child nodes
			var $child = _getChildNodes($this);
			//child count
			var count = $child.length;
			if ($this.data('count') === undefined || $this.data('loaded') || $this.data('count') == count) {
				if (!$this.data('loadNeeded')) {
					$this.data({
						loaded: true,
						count: count
					});
					if (count && forceExpand) $this.addClass('expanded');
				}
			} else $this.data('loadNeeded', true);
			//container
			$td = $this.find('>td:first'), $container = $td.find('>.treegrid-container');
			if ($container.length === 0) {
				$container = $('<div class="treegrid-container">').html($td.html());
				$td.html('').append($container);
			};
			//expander
			$container.find('.treegrid-expander').remove();
			$expander = $('<span class="treegrid-expander">').prependTo($container);
			if ($this.data('count')) {
				if ($this.hasClass('expanded')) $expander.addClass('treegrid-expander-expanded');
				else $expander.addClass('treegrid-expander-collapsed');
			};
			//indent
			$container.css('marginLeft', depth * $expander.width());
			//hide if collapsed
			if (_parentCollapsed($this)) $this.hide();
			//init child nodes
			_initNode($child, depth + 1, forceExpand);
		});
	};
	function _expanderClick() {
		var $this = $(this);
		if ($this.hasClass('treegrid-expander-expanded') || $this.hasClass('treegrid-expander-collapsed')) {
			methods.toggle.call($this.closest('tr'));
		}
	};
	function _parentCollapsed($this) {
		if (_getParentId($this) === null) return false;
		var $parent = _getParent($this);
		if (_isCollapsed($parent)) return true;
		return _parentCollapsed($parent);
	};
	function _load($this) {
		var settings = $this.closest('table').data('treegrid-settings');
		_getBranch($this).not($this).remove();
		//function
		if ($.isFunction(settings.source)) {
			var items = settings.source.call($this, _getId($this));
			if ($.isArray(items)) {
				$this.removeDate('loadNeeded').data('loaded', true);
				_add($this, items);
				return true;
			}
		};
		//url
		if ($.type(settings.source) === 'string' && !$this.hasClass('loading')) {
			$this.addClass('loading');
			$.post(settings.source, {id: _getId($this)}, function(items) {
				$this.removeDate('loadNeeded').data('loaded', true);
				_add($this, items);
				$this.removeClass('loading');
			}, 'json');
		};

		return false;
	};

	// MOVING FUNCTIONS
	// ================

	//move vars
	var $moveItem = null, $moveHelper = null, $moveTarget = null, $indicator,
		downX, downY, offX, offY, isDragging = false, dropMap, position, expandTimer = false;
	//move events
	function _nodeMouseDown(e) {
		//left mouse button
		if (e.button !== 0) return;
		//move enabled?
		var $this = $(this), o = $this.closest('table').data('treegrid-settings');
		if (!o.enableMove) return;
		//node expander?
		var $el = $(e.target);
		if ($el.hasClass('treegrid-expander')) return;
		//handle
		if ((o.moveHandle !== false) && ($this.find(o.moveHandle)[0] != $el[0])) return;

		//move
		$moveItem = $this.closest('tr');
		downX = e.pageX;
		downY = e.pageY;
		var offset = $this.offset();
		offX = offset.left - e.pageX;
		offY = offset.top - e.pageY;
		$(document).on('mouseup', _nodeMouseUp).on('mousemove', _nodeMouseMove);
		return false;
	};
	function _nodeMouseUp(e) {
		if (isDragging) _dragStop();
		$(document).off('mouseup', _nodeMouseUp).off('mousemove', _nodeMouseMove);
	};
	function _nodeMouseMove(e) {
		var d = Math.max(Math.abs(e.pageX - downX), Math.abs(e.pageY - downY)),
			settings = $moveItem.closest('table').data('treegrid-settings');
		if (d >= settings.moveDistance && !isDragging) _dragStart(e);
		else if (isDragging) _dragMove(e);
	};
	function _dragStart(e) {
		isDragging = true;
		//make drop map
		_makeDropMap();
		//make helper
		$moveHelper = $moveItem.find('>td:first>.treegrid-container').clone().addClass('dragging').css({
			left: e.pageX + offX,
			top: e.pageY + offY
		});
		$moveHelper.find('>.treegrid-expander').remove();
		$moveHelper.appendTo('body');
		//make indicator
		if ($('.treegrid-move-indicator').length) return;
		$indicator = $('<div class="treegrid-move-indicator">').appendTo('body');
		//event callback
		var $treegrid = $moveItem.closest('table'), settings = $treegrid.data('treegrid-settings');
		settings.onMoveStart.call($treegrid, $moveItem, $moveHelper);
	};
	function _dragMove(e) {
		//move helper
		$moveHelper.css({
			'left': e.pageX + offX,
			'top': e.pageY + offY
		});
		//check drop map
		var $el = null;
		$.each(dropMap, function(i, v) {
			if ((e.pageX >= v[0]) && (e.pageY >= v[1]) && (e.pageX <= v[0] + v[2]) && (e.pageY <= v[1] + v[3])) {
				if (_dragOver(e, v)) $el = v[4];
				return false;
			}
		});
		if ($moveTarget !== null && $el !== $moveTarget) _dragOut($el == null);
		$moveTarget = $el;
	};
	function _dragStop() {
		isDragging = false;
		//event callback
		var $treegrid = $moveItem.closest('table'), settings = $treegrid.data('treegrid-settings');
		settings.onMoveStop.call($treegrid, $moveItem, $moveHelper);
		//remove helper
		$moveHelper.remove();
		//remove indicator
		$indicator.remove();
		//auto expand
		if (expandTimer !== false) {
			window.clearTimeout(expandTimer);
			expandTimer = false;
		};
		//drop
		if ($moveTarget !== null) _dragDrop();
	};
	function _dragOver(e, v) {
		//psition
		var h1 = v[3] / 4, h2 = h1 * 3, y = e.pageY - v[1], t, p;
		if (y < h1) {
			t = v[1];
			p = 0;
		} else if (y >= h2) {
			t = v[1] + v[3];
			p = 2;
		} else {
			t = v[1] + v[3] / 2;
			p = 1;
		};
		if (v[4] == $moveTarget && p == position) return true;
		//can't move into null id
		if (p == 1 && _getId(v[4]) === null) return false;
		//auto expand
		var $el = v[4];
		if (_isCollapsed($el) && expandTimer === false) expandTimer = window.setTimeout(function() {
			//methods.expand because loaded check needed
			methods.expand.call($el);
			expandTimer = false;
		}, 500);
		//event callback
		var $treegrid = $moveItem.closest('table'), settings = $treegrid.data('treegrid-settings');
		if (!settings.onMoveOver.call($treegrid, $moveItem, $moveHelper, v[4], p)) return false;
		//indicator
		$indicator.css({
			'display': 'block',
			'left': v[4].find('>td:first>.treegrid-container').offset().left,
			'top': t
		});

		position = p;
		return true;
	};
	function _dragOut(hideIndicator) {
		//event callback
		var $treegrid = $moveItem.closest('table'), settings = $treegrid.data('treegrid-settings');
		settings.onMoveOut.call($treegrid, $moveItem, $moveHelper, $moveTarget);
		//indicator
		if (hideIndicator) $indicator.hide();
		//auto expand
		if (expandTimer !== false) {
			window.clearTimeout(expandTimer);
			expandTimer = false;
		}
	};
	function _dragDrop() {
		//do out
		_dragOut(true);
		//callback
		var $treegrid = $moveItem.closest('table'), settings = $treegrid.data('treegrid-settings'),
			doMove = settings.onMove.call($treegrid, $moveItem, $moveTarget, position);
		if (doMove !== false) methods.move.call($moveItem, $moveTarget, position);
	};
	//move additional functions
	function _makeDropMap() {
		var branch = [];
		_getBranch($moveItem).each(function() {
			branch.push(_getId($(this)));
		});

		dropMap = [];
		$moveItem.parent().find('tr').each(function() {
			var $this = $(this), id;
			if ($.inArray(_getId($this), branch) === -1) {
				var o = $this.offset();
				dropMap.push([o.left, o.top, $this.width(), $this.height(), $this]);
			}
		});
	};

	$.fn.treegrid = function(method) {
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return _initTree.apply(this, arguments);
		} else {
			$.error('Method with name ' + method + ' does not exists for jQuery.treegrid');
		}
	};

	$.fn.treegrid.defaults = {
		source: null, //Function()|Url Result should be in add() function format. For Url 'json' format is used.
		enableMove: false, //Boolean To let user move nodes set it in true.
		moveDistance: 10, //Integer Tolerance, in pixels, for when moving should start. If specified, moving will not start until after mouse is dragged beyond distance.
		moveHandle: false, //Selector|Element Restricts moving start click to the specified element.
		onExpand: function() { return true; }, //Function() Calling when node expands. Return false if you dont want the node been expanded.
		onCollapse: function() { return true; }, //Function() Calling when node collapses. Return false if you dont want the node been collapsed.
		onAdd: function() {}, //Function(items) Calling when nodes was added. Returns jQuery container that contains all added nodes.
		onMoveStart: function() {}, //Function(item, helper) This event is triggered when node moving starts.
		onMoveStop: function() {}, //Function(item, helper) This event is triggered when node moving ends.
		onMoveOver: function() { return true; }, //Function(item, helper, target, position) This event is triggered when node moving over another node that support droping. If you dont want target supporting dropping, return false.
		onMoveOut: function() {}, //Function(item, helper, target) This event is triggered when node outs another node that support droping.
		onMove: function() { return true; } //Function(item, target, position) This event is triggered when node drops to another node. If you want to prevent moving, return false.
	};

})(jQuery);
