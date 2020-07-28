import React from "react";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import Typography from "@material-ui/core/Typography";
import StepLabel from "@material-ui/core/StepLabel";
import StepConnector from "@material-ui/core/StepConnector";
import Button from "@material-ui/core/Button";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
    root: {

    },
    button: {
        marginRight: theme.spacing(1),
    },
    actions: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
    },
    icon: {
        backgroundColor: "#ccc",
        zIndex: 1,
        color: "#fff",
        width: 50,
        height: 50,
        display: "flex",
        borderRadius: "50%",
        justifyContent: "center",
        alignItems: "center",
    },
    active: {
        backgroundImage: "linear-gradient( 136deg, rgb(242,113,33) 0%, rgb(233,64,87) 50%, rgb(138,35,135) 100%)",
        boxShadow: "0 4px 10px 0 rgba(0,0,0,.25)"
    },
    completed: {
        backgroundImage: "linear-gradient( 136deg, rgb(242,113,33) 0%, rgb(233,64,87) 50%, rgb(138,35,135) 100%)",
    }
}));

const Connector = withStyles({
    alternativeLabel: {
        top: 22,
    },
    disabled: {
        "& $line": {
            backgroundColor: "red"
        }
    },
    completed: {
        "& $line": {
            backgroundImage:
                "linear-gradient( 95deg,rgb(242,113,33) 0%,rgb(233,64,87) 50%,rgb(138,35,135) 100%)",
        },
    },
    line: {
        height: 3,
        border: 0,
        backgroundColor: "#eaeaf0",
        borderRadius: 1,
    },
})(StepConnector);

export default function StepperWidget({ className, steps, state, actions, ...props }) {
    const classes = useStyles();
    const [stepId, setStepId] = state;
    steps = steps.filter(step => {
        if (typeof step.visible === "undefined") {
            return true;
        }
        return step.visible;
    });
    const stepIdx = steps.findIndex(step => step.id === stepId);

    const actionItems = actions.map(action => {
        let {title, visible} = action;
        if (typeof visible === "function") {
            visible = visible({ id: stepId, idx: stepIdx });
        }
        if (typeof title === "function") {
            title = title({ id: stepId, idx: stepIdx });
        }
        const onClick = () => {
            const idx = action.click({ id: stepId, idx: stepIdx });
            const step = steps[idx];
            if (step) {
                setStepId(step.id);
            }
        };
        return (<Button
            key={action.id}
            variant="contained"
            color="primary"
            onClick={onClick}
            className={classes.button}
            style={{...!visible && {visibility:"hidden"}}}
        >
            {title}
        </Button>);
    });

    className = clsx(className, classes.root);

    function Icon({ active, completed, disabled, icon }) {
        const classes = useStyles();
        const stepIdx = parseInt(icon) - 1;
        const step = steps[stepIdx];

        if (!step) {
            return null;
        }

        return (
            <div
                className={clsx(classes.icon, {
                    [classes.disabled]: disabled,
                    [classes.active]: active,
                    [classes.completed]: completed,
                    [classes.selected]: step.id === stepId
                })}
            >
                {step.icon}
            </div>
        );
    }

    return (
        <div className={className} {...props}>
            <Stepper alternativeLabel nonLinear activeStep={stepIdx} connector={<Connector />}>
                {steps.map((step, idx) => {
                    let { id, label, subLabel } = step;
                    const previousStep = steps[idx - 1];
                    const previousIsDisabled = previousStep && previousStep.disabled;
                    const disabled = step.disabled;
                    let completed = idx <= stepIdx;
                    let active = idx === stepIdx;
                    if (previousIsDisabled && completed && !disabled) {
                        active = true;
                        completed = false;
                    }
                    if (disabled) {
                        active = false;
                        completed = false;
                    }
                    const stepProps = { active, completed, disabled };
                    let style = {};
                    if(idx === stepIdx) {
                        style = {
                            fontWeight:"bold"
                        };
                    }
                    const stepLabelProps = { StepIconComponent: Icon };
                    return (
                        <Step key={id} {...stepProps}>
                            <StepLabel {...stepLabelProps}>
                                <Typography variant="body1" style={style}>
                                    {label}
                                </Typography>
                                <Typography variant="body2">
                                    {subLabel}
                                </Typography>
                            </StepLabel>
                        </Step>
                    );
                })}
            </Stepper>
            <div className={classes.actions}>
                {actionItems}
            </div>
        </div>
    );
}
