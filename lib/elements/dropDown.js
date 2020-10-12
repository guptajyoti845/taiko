const { setNavigationOptions } = require('../config');
const { descEvent } = require('../eventBus');
const Element = require('./element');
const { defaultConfig } = require('../config');
const { highlightElement } = require('./elementHelper');
const { doActionAwaitingNavigation } = require('../doActionAwaitingNavigation');
const { isRegex } = require('../helper');

class DropDown extends Element {
  async select(values) {
    if (defaultConfig.headful) {
      await highlightElement(this);
    }

    function selectBox(values) {
      let found_value = {};
      let selectAndDispatchEvent = function (self, index) {
        self[index].selected = true;
        ['change', 'input'].forEach((ev) => {
          let event = new Event(ev, { bubbles: true });
          try {
            self.dispatchEvent(event);
          } catch (e) {
            return {
              error: `Error occurred while dispatching ${ev} event`,
              stack: e.stack,
            };
          }
        });
        return true;
      };
      if (values.length < 1) {
        found_value[''] = { isAvailable: false };
        return found_value;
      }
      //need clarification
      if (!this.multiple && values.length > 1) {
        return {
          error: 'Cannot select multiple values on a single select dropdown',
          stack: '',
        };
      }

      values.every((value) => {
        if (this.options.length > value) {
          if (this.options[value].disabled) {
            found_value[value] = { isDisabled: true };
            return false;
          } else {
            let ele = selectAndDispatchEvent(this, value);
            found_value[value] = { isAvailable: ele };
            return true;
          }
        }
      });
      if (Object.keys(found_value).length > 0) {
        return found_value;
      }

      values.every((value) => {
        var found = false;
        var disabled = false;
        for (var i = 0; i < this.options.length; i++) {
          let option = this.options[i];
          if (option.text === value || option.value === value) {
            found = true;
            if (option.disabled) {
              found_value[value] = { isDisabled: true };
              disabled = true;
              break;
            } else {
              let ele = selectAndDispatchEvent(this, i);
              found_value[value] = { isAvailable: ele };
              return true;
            }
          }
        }
        if (disabled) {
          return false;
        }
        if (!found) {
          found_value[value] = { isAvailable: false };
          return false;
        }
      });
      return found_value;
    }
    const options = setNavigationOptions({});

    // RegExp is not serialised. So loop through dropdown text and find a match
    // before invoking via CDP API

    let valuesToSelect = values;
    if (!values) {
      valuesToSelect = [];
    } else if (Array.isArray(values)) {
      valuesToSelect = values;
    } else if (typeof values === 'object' && 'index' in values) {
      if (Array.isArray(values.index)) {
        valuesToSelect = values.index;
      } else {
        valuesToSelect = [values.index];
      }
    } else if (isRegex(values)) {
      let options = await this.text();
      valuesToSelect = await options.split('\n').filter((option) => values.exec(option));
    } else {
      valuesToSelect = [values];
    }

    await doActionAwaitingNavigation(options, async () => {
      const { result } = await this.runtimeHandler.runtimeCallFunctionOn(selectBox, null, {
        objectId: this.get(),
        arg: valuesToSelect,
        returnByValue: true,
      });
      const { stack, error } = result.value;
      if (stack) {
        throw new Error(error + '\n' + stack);
      } else if (error) {
        throw new Error(error);
      }

      let disabledValues = [];
      let unavailableValues = [];
      Object.keys(result.value).forEach((key) => {
        if (result.value[key].isDisabled) {
          disabledValues.push(key);
        }
        if (!result.value[key].isAvailable) {
          unavailableValues.push(key);
        }
      });

      if (disabledValues.length > 0) {
        throw new Error(`Cannot set value ${disabledValues.join(',')} on a disabled field`);
      }
      if (unavailableValues.length > 0) {
        throw new Error(`Option(s) ${unavailableValues.join(',')} not available in dropdown`);
      }
    });

    descEvent.emit('success', 'Selected ' + (values.index || values));
  }
  async value() {
    function getValue() {
      if (this.value) {
        return this.value;
      }
      return this.innerText;
    }
    const { result } = await this.runtimeHandler.runtimeCallFunctionOn(getValue, null, {
      objectId: this.get(),
    });
    return result.value;
  }

  async options() {
    function getOptions() {
      let dropDownValues = [];
      for (let index = 0; index < this.options.length; index++) {
        dropDownValues.push(this.options[index].value);
      }
      return dropDownValues;
    }
    const { result } = await this.runtimeHandler.runtimeCallFunctionOn(getOptions, null, {
      objectId: this.get(),
      returnByValue: true,
    });
    return result.value;
  }

  static from(element, description) {
    return new DropDown(element.get(), description, element.runtimeHandler);
  }
}

module.exports = DropDown;
