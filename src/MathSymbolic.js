/*
    Copyright 2008,2009
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXGraph. If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @fileoverview In this file the namespace Math.Symbolic is defined, which holds methods
 * and algorithms for symbolic computations.
 * @author graphjs
 */
/**
 * Math.Symbolic
 */
JXG.Math.Symbolic = {};

/**
 * Generates symbolic coordinates for the part of a construction including all the elements from that
 * a specific element depends of. These coordinates will be stored in GeometryElement.symbolic.
 * @param {JXG.Board} board The board that's element get some symbolic coordinates.
 * @param {JXG.GeometryElement} element All ancestor of this element get symbolic coordinates.
 * @param {String} variable Name for the coordinates, e.g. x or u.
 * @param {String} append Method for how to append the number of the coordinates. Possible values are
 *                        'underscore' (e.g. x_2), 'none' (e.g. x2), 'brace' (e.g. x[2]).
 * @type int
 * @return Number of coordinates given.
 */
JXG.Math.Symbolic.generateSymbolicCoordinatesPartial = function(board, element, variable, append) {
    var makeCoords = function(num) {
        	if (append == 'underscore')
            	return '' + variable + '_{' + num + '}';
	        else if (append == 'brace')
    	        return '' + variable + '[' + num + ']';
    	    else
    	        return '' + variable + '' + num;
	    },
	    list = element.ancestors,
	    count = 0, t_num, t, k;

	board.listOfFreePoints = [];
	board.listOfDependantPoints = [];

    for(t in list) {
        t_num = 0;
        if (JXG.isPoint(list[t])) {
            for(k in list[t].ancestors) {
                t_num++;
            }
            if(t_num == 0) {
                list[t].symbolic.x = list[t].coords.usrCoords[1];
                list[t].symbolic.y = list[t].coords.usrCoords[2];
                board.listOfFreePoints.push(list[t]);

            } else {
                count++;
                list[t].symbolic.x = makeCoords(count);
                count++;
                list[t].symbolic.y = makeCoords(count);
                board.listOfDependantPoints.push(list[t]);
            }

        }
    }

    if(JXG.isPoint(element)) {
        element.symbolic.x = 'x';
        element.symbolic.y = 'y';
    }

    return count;
};

/**
 * Clears all .symbolic.x and .symbolic.y members on every point of a given board.
 * @param {JXG.Board} board The board that's points get cleared their symbolic coordinates.
 */
JXG.Math.Symbolic.clearSymbolicCoordinates = function(board) {
	var clear = function(list) {
		if((list == null) || (typeof list == 'undefined'))
			return;

		var t;

	    for(t=0; t<list.length; t++) {
	        if (JXG.isPoint(list[t])) {
	            list[t].symbolic.x = '';
	            list[t].symbolic.y = '';
	        }
	    }
	};

	clear(board.listOfFreePoints);
	clear(board.listOfDependantPoints);

    delete (board.listOfFreePoints);
    delete (board.listOfDependantPoints);
};

/**
 * Generates polynomials for the part of a construction including all the points from that
 * a specific element depends of.
 * @param {JXG.Board} board The board that's points polynomials will be generated.
 * @param {JXG.GeometryElement} element All points in the set of ancestors of this element are used to generate the set of polynomials.
 * @type Array
 * @return Array of polynomials as strings.
 */
JXG.Math.Symbolic.generatePolynomials = function(board, element, generateCoords) {
    if(generateCoords)
        this.generateSymbolicCoordinatesPartial(board, element, 'u', 'brace');

    var list = element.ancestors,
        number_of_ancestors,
        pgs = [],
        result = [],
        t, k, i;

    list[element.id] = element;

    for(t in list) {
        number_of_ancestors = 0;
        pgs = [];
        if (JXG.isPoint(list[t])) {
            for(k in list[t].ancestors) {
                number_of_ancestors++;
            }
            if(number_of_ancestors > 0) {
                pgs = list[t].generatePolynomial();
                for(i=0; i<pgs.length; i++)
                    result.push(pgs[i]);
            }
        }
    }

    if(generateCoords)
        this.clearSymbolicCoordinates(board);

    return result;
};

/**
 * Calculate geometric locus of a point given on a board. Invokes python script on server.
 * @param {JXG.Board} board The board on that the point lies.
 * @param {JXG.Point} point The point that will be traced.
 * @param {function} callback A callback function that is called after the server request is finished.
 *    Must take an array of strings as the only parameter.
 * @type Array
 * @return Array of points.
 */
JXG.Math.Symbolic.geometricLocusByGroebnerBase = function(board, point, callback) {
    var numDependent = this.generateSymbolicCoordinatesPartial(board, point, 'u', 'brace'),
        poly, polyStr, result, oldRadius = {},
        xsye = new JXG.Coords(JXG.COORDS_BY_USR, [0,0], board),
        xeys = new JXG.Coords(JXG.COORDS_BY_USR, [board.canvasWidth, board.canvasHeight], board),
        P1, P2, i, sf = 1, transx = 0, transy = 0, rot = 0, c, s, tx,
        xs, xe, ys, ye,

        isIn = function(item, array) {
        	var i, is = false;
        	for(i=0; i<array.length; i++) {
        		if(array[i].id == item) {
        			is = true;
        			break;
        		}
        	}
        	return is;
        },
        bol = board.options.locus;


    if(typeof JXG.Server.modules.geoloci == 'undefined')
        JXG.Server.loadModule('geoloci')

    if(typeof JXG.Server.modules.geoloci == 'undefined')
        throw new Error("JSXGraph: Unable to load JXG.Server module 'geoloci.py'.");

    xs = xsye.usrCoords[1];
    xe = xeys.usrCoords[1];
    ys = xeys.usrCoords[2];
    ye = xsye.usrCoords[2];

    // Optimizations - but only if the user wants to
    //   Step 1: Translate all related points, such that one point P1 (board.options.locus.toOrigin if set
    //     or a random point otherwise) is moved to (0, 0)
    //   Step 2: Rotate the construction around the new P1, such that another point P2 (board.options.locus.to10 if set
    //     or a random point \neq P1 otherwise) is moved onto the positive x-axis
    //  Step 3: Dilate the construction, such that P2 is moved to (1, 0)
    //  Step 4: Give the scale factor (sf), the rotation (rot) and the translation vector (transx, transy) to
    //    the server, which retransforms the plot (if any).

    // Step 1
    if(bol.translateToOrigin && (board.listOfFreePoints.length > 0)) {
		if((typeof bol.toOrigin != 'undefined') && (bol.toOrigin != null) && isIn(bol.toOrigin.id, board.listOfFreePoints)) {
			P1 = bol.toOrigin;
		} else {
			P1 = board.listOfFreePoints[0];
		}

		transx = P1.symbolic.x;
		transy = P1.symbolic.y;
		// translate the whole construction
		for(i=0; i<board.listOfFreePoints.length; i++) {
			board.listOfFreePoints[i].symbolic.x -= transx;
			board.listOfFreePoints[i].symbolic.y -= transy;
		}

        xs -= transx; xe -= transx;
        ys -= transy; ye -= transy;

		// Step 2
		if(bol.translateTo10 && (board.listOfFreePoints.length > 1)) {
			if((typeof bol.to10 != 'undefined') && (bol.to10 != null) && (bol.to10.id != bol.toOrigin.id) && isIn(bol.to10.id, board.listOfFreePoints)) {
				P2 = bol.to10;
			} else {
				if(board.listOfFreePoints[0].id == P1.id)
					P2 = board.listOfFreePoints[1]
				else
					P2 = board.listOfFreePoints[0];
			}

            rot = JXG.Math.Geometry.rad([1, 0], [0, 0], [P2.symbolic.x, P2.symbolic.y]);
            c = Math.cos(-rot);
            s = Math.sin(-rot);


    		for(i=0; i<board.listOfFreePoints.length; i++) {
                tx = board.listOfFreePoints[i].symbolic.x;
		    	board.listOfFreePoints[i].symbolic.x = c*board.listOfFreePoints[i].symbolic.x - s*board.listOfFreePoints[i].symbolic.y;
	    		board.listOfFreePoints[i].symbolic.y = s*tx + c*board.listOfFreePoints[i].symbolic.y;
    		}

            // thanks to the rotation this is zero
            P2.symbolic.y = 0;

            tx = xs;
            xs = c*xs - s*ys;
            ys = s*tx + c*ys;
            tx = xe;
            xe = c*xe - s*ye;
            ye = s*tx + c*ye;

			// Step 3
			if(bol.stretch && (Math.abs(P2.symbolic.x) > JXG.Math.eps)) {
                sf = P2.symbolic.x;

 	    	    for(i=0; i<board.listOfFreePoints.length; i++) {
  		    	    board.listOfFreePoints[i].symbolic.x /= sf;
    		        board.listOfFreePoints[i].symbolic.y /= sf;
   		        }

                for(i in board.objects) {
                    if((board.objects[i].elementClass == JXG.OBJECT_CLASS_CIRCLE) && (board.objects[i].method == 'pointRadius')) {
                        oldRadius[i] = board.objects[i].radius;
                        board.objects[i].radius /= sf;
                    }
                }

                xs /= sf; xe /= sf;
                ys /= sf; ye /= sf;

                // this is now 1
                P2.symbolic.x = 1;
            }
		}

        // make the coordinates "as rational as possible"
        for(i=0; i<board.listOfFreePoints.length; i++) {
            tx = board.listOfFreePoints[i].symbolic.x;
            if(Math.abs(tx) < JXG.Math.eps)
                board.listOfFreePoints[i].symbolic.x = 0;
            if(Math.abs(tx - Math.round(tx)) < JXG.Math.eps)
                board.listOfFreePoints[i].symbolic.x = Math.round(tx);

            tx = board.listOfFreePoints[i].symbolic.y;
            if(Math.abs(tx) < JXG.Math.eps)
                board.listOfFreePoints[i].symbolic.y = 0;
            if(Math.abs(tx - Math.round(tx)) < JXG.Math.eps)
                board.listOfFreePoints[i].symbolic.y = Math.round(tx);
        }
    }

    // end of optimizations

    poly = this.generatePolynomials(board, point);
    polyStr = poly.join(',');

    this.cbp = function(data) {
        //alert(data.exectime);
        //callback(data.datax, data.datay, data.polynomial);
        result = data;
    };

    this.cb = JXG.bind(this.cbp, this);

    JXG.Server.modules.geoloci.lociCoCoA(xs, xe, ys, ye, numDependent, polyStr, sf, rot, transx, transy, this.cb, true);

    this.clearSymbolicCoordinates(board);

    for(i in oldRadius) {
        board.objects[i].radius = oldRadius[i];
    }

    JXG.debug(result);

    return result;
};
