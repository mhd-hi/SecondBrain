import type { ReviewPayload } from '@/lib/ai/chat/types';

/**
 * Versioned MCP App review resource (plan section 12).
 *
 * One self-contained HTML document served as `text/html;profile=mcp-app`.
 * Security properties:
 * - Every dynamic value reaches the page through a JSON data island and is
 *   written with `textContent`; nothing is ever passed to `innerHTML`.
 * - No external scripts, no remote origins, no eval, no dynamic script
 *   construction; user-controlled values cannot enter script source because
 *   data travels only through JSON.parse of the data island.
 * - The approval capability exists only in component memory; it is never
 *   persisted to local storage and never leaves except in the app-only
 *   commit/reject tool arguments.
 * - Buttons disable after the first click; final state renders only from the
 *   authoritative commit result.
 */

export const TASK_REVIEW_RESOURCE_URI = 'ui://second-brain/task-review/v1';

export const TASK_REVIEW_RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

export type TaskReviewBoot = {
  review: {
    draftId: string;
    summary: string;
    reason: string;
    status: string;
    expiresAt: string;
    reviewPayload: ReviewPayload;
  };
  capability: string | null;
  capabilityExpiresAt: string | null;
};

function jsonForScriptIsland(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function buildTaskReviewHtml(boot: TaskReviewBoot): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Second Brain: task review</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: CanvasText;
    background: Canvas;
  }
  .wrap { padding: 12px; }
  h1 { font-size: 15px; margin: 0 0 2px; }
  .reason { margin: 0 0 8px; color: GrayText; }
  .muted { color: GrayText; }
  .meta { font-size: 12px; margin-bottom: 10px; }
  .counts { display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
  .pill {
    border: 1px solid ButtonBorder;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 12px;
  }
  .pill.del { color: #b42318; border-color: #b42318; font-weight: 600; }
  .item { border: 1px solid ButtonBorder; border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
  .item.del { border-color: #b42318; border-width: 2px; }
  .item .head { display: flex; justify-content: space-between; gap: 8px; font-weight: 600; }
  .risk { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
  .risk.high { color: #b42318; }
  .risk.medium { color: #b45309; }
  .risk.low { color: GrayText; }
  .course-line { font-size: 12px; margin-top: 2px; }
  .diff { font-size: 12px; margin-top: 6px; }
  .diff div { margin: 1px 0; }
  .old-val { color: #b42318; text-decoration: line-through; }
  .new-val { color: #067647; }
  .warnings { margin: 6px 0 0; padding-left: 18px; color: #b45309; }
  .actions { display: flex; gap: 8px; margin-top: 12px; position: sticky; bottom: 0; background: Canvas; padding: 8px 0; }
  button {
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid ButtonBorder;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button.approve { background: #067647; border-color: #067647; color: #fff; }
  button.reject { background: transparent; color: inherit; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .status { margin-top: 8px; font-weight: 600; min-height: 1em; }
  .status.err { color: #b42318; }
  .status.ok { color: #067647; }
</style>
</head>
<body>
<div class="wrap">
  <h1 id="title"></h1>
  <p class="reason" id="reason"></p>
  <div class="meta muted" id="expires"></div>
  <div class="counts" id="counts"></div>
  <div id="items"></div>
  <div class="actions">
    <button class="reject" id="reject" type="button">Reject</button>
    <button class="approve" id="approve" type="button">Approve</button>
  </div>
  <div class="status" id="status" role="status" aria-live="polite"></div>
</div>
<script type="application/json" id="sb-review-data">${jsonForScriptIsland(boot)}</script>
<script>
(function () {
  'use strict';
  var boot = JSON.parse(document.getElementById('sb-review-data').textContent);
  var capability = boot.capability || null;
  var capabilityExpiresAt = boot.capabilityExpiresAt
    ? new Date(boot.capabilityExpiresAt).getTime()
    : 0;
  var done = false;
  var rpcId = 0;
  var pending = {};

  function el(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }
  function setText(node, text) {
    node.textContent = text == null ? '' : String(text);
  }

  function setButtons(enabled) {
    document.getElementById('approve').disabled = !enabled;
    document.getElementById('reject').disabled = !enabled;
  }

  function render() {
    setText(document.getElementById('title'), boot.review.summary);
    setText(document.getElementById('reason'), boot.review.reason);
    setText(
      document.getElementById('expires'),
      'Expires ' + new Date(boot.review.expiresAt).toLocaleString()
    );
    var counts = boot.review.reviewPayload.counts;
    var countsEl = document.getElementById('counts');
    var pills = [
      ['', counts.adds + ' add' + (counts.adds === 1 ? '' : 's')],
      ['', counts.updates + ' update' + (counts.updates === 1 ? '' : 's')],
      ['del', counts.deletes + ' delete' + (counts.deletes === 1 ? '' : 's')]
    ];
    pills.forEach(function (pair) {
      var pill = el('span', 'pill' + (pair[0] === 'del' && counts.deletes > 0 ? ' del' : ''));
      setText(pill, pair[1]);
      countsEl.appendChild(pill);
    });

    var itemsEl = document.getElementById('items');
    (boot.review.reviewPayload.items || []).forEach(function (item) {
      var card = el('div', 'item' + (item.type === 'delete' ? ' del' : ''));
      var head = el('div', 'head');
      var name = el('span');
      var courseTag = item.courseCode ? '[' + item.courseCode + '] ' : '';
      var label = item.type === 'delete'
        ? 'Delete: ' + courseTag + item.title
        : item.type === 'add'
          ? 'Add: ' + courseTag + item.title
          : courseTag + item.title;
      setText(name, label);
      var risk = el('span', 'risk ' + item.riskLevel);
      setText(risk, item.riskLevel);
      head.appendChild(name);
      head.appendChild(risk);
      card.appendChild(head);

      if (item.courseName) {
        var courseLine = el('div', 'muted course-line');
        setText(courseLine, item.courseName);
        card.appendChild(courseLine);
      }

      if (item.warnings && item.warnings.length) {
        var list = el('ul', 'warnings');
        item.warnings.forEach(function (warning) {
          var li = el('li');
          setText(li, warning);
          list.appendChild(li);
        });
        card.appendChild(list);
      }

      var diff = item.diff || {};
      if (Object.keys(diff).length) {
        var diffEl = el('div', 'diff');
        Object.keys(diff).forEach(function (key) {
          var row = el('div');
          var keyLabel = el('span', 'muted');
          setText(keyLabel, key + ': ');
          row.appendChild(keyLabel);
          if (diff[key].before !== undefined && diff[key].before !== null) {
            var before = el('span', 'old-val');
            setText(before, diff[key].before);
            row.appendChild(before);
            row.appendChild(document.createTextNode(' '));
          }
          if (diff[key].after !== undefined && diff[key].after !== null) {
            var after = el('span', 'new-val');
            setText(after, diff[key].after);
            row.appendChild(after);
          }
          diffEl.appendChild(row);
        });
        card.appendChild(diffEl);
      }
      itemsEl.appendChild(card);
    });
  }

  // Minimal MCP Apps bridge: JSON-RPC 2.0 over window.postMessage to the
  // host frame (same wire format as the official PostMessageTransport).
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.id !== undefined && pending[message.id]) {
      var resolve = pending[message.id];
      delete pending[message.id];
      resolve(message);
    }
  });

  function callTool(name, args) {
    return new Promise(function (resolve, reject) {
      rpcId += 1;
      var id = rpcId;
      var timeout = setTimeout(function () {
        if (pending[id]) {
          delete pending[id];
          reject(new Error('Request timed out'));
        }
      }, 20000);
      pending[id] = function (message) {
        clearTimeout(timeout);
        resolve(message);
      };
      window.parent.postMessage({
        jsonrpc: '2.0',
        id: id,
        method: 'tools/call',
        params: { name: name, arguments: args }
      }, '*');
    });
  }

  function extractError(response) {
    if (response.error) return response.error.message || 'request failed';
    var result = response.result;
    if (!result) return 'no result';
    if (result.isError) {
      try {
        var parsed = JSON.parse(result.content[0].text);
        return parsed.message || parsed.code || 'error';
      } catch (error) {
        return 'error';
      }
    }
    return null;
  }

  function act(toolName, runningLabel, successLabel) {
    if (done) return;
    if (!capability) {
      var statusEl = document.getElementById('status');
      statusEl.className = 'status err';
      setText(statusEl, 'No approval capability. Use the web review link.');
      return;
    }
    done = true;
    setButtons(false);
    var status = document.getElementById('status');
    status.className = 'status';
    setText(status, runningLabel);
    callTool(toolName, {
      draftId: boot.review.draftId,
      approvalCapability: capability
    })
      .then(function (response) {
        var error = extractError(response);
        if (error) {
          status.className = 'status err';
          setText(status, 'Failed: ' + error);
          done = false;
          setButtons(true);
          return;
        }
        status.className = 'status ok';
        setText(status, successLabel);
      })
      .catch(function (error) {
        status.className = 'status err';
        setText(status, 'Failed: ' + (error && error.message ? error.message : 'unknown error'));
        done = false;
        setButtons(true);
      });
  }

  document.getElementById('approve').addEventListener('click', function () {
    act('commit_task_changes', 'Executing...', 'Approved. Tasks updated.');
  });
  document.getElementById('reject').addEventListener('click', function () {
    act('reject_task_changes', 'Rejecting...', 'Draft rejected.');
  });

  render();
  setButtons(Boolean(capability));
  if (!capability) {
    var status = document.getElementById('status');
    status.className = 'status err';
    setText(status, 'Open the web review link to approve this draft.');
  }
})();
</script>
</body>
</html>`;
}
